const { Spinner } = require('cli-spinner');
const dotenv = require('dotenv');
const figlet = require('figlet');
const fs = require('fs');
const vorpal = require('vorpal')();
const fsAutocomplete = require('vorpal-autocomplete-fs');

const { PromptStore } = require('./promptstore');

const VERSION = '0.1.0';

const ENV = process.env.ENV?.toLowerCase();
if (ENV === 'dev') {
  dotenv.config();
}

const logger = require('./logger');

const promptStore = new PromptStore({ logger });

function splash() {
  return new Promise((resolve, reject) => {
    import('chalk').then(({ default: chalk }) => {
      figlet('Prompt Store', (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        console.log(chalk.bold.magentaBright(data));
        console.log('environment:', ENV || 'prod');
        console.log('version    :', VERSION);
        resolve();
      });
    });
  });
}

/**
 * @example
 * const done = spin('Get going');
 * setTimeout(() => { done('Thats a wrap.'); }, 5000);
 * 
 * @param {*} startLabel 
 * @returns 
 */
function spin(startLabel) {
  if (!startLabel) startLabel = 'processing';
  const spinner = new Spinner(startLabel + '... %s');
  spinner.setSpinnerString(27);
  spinner.start();
  return (finishLabel) => {
    if (!finishLabel) finishLabel = 'Task completed.';
    spinner.setSpinnerTitle(finishLabel);
    setTimeout(() => {
      spinner.stop();
    }, 500);
  };
}

async function watch(folder) {
  const { LowSync } = await import('lowdb');
  const { JSONFileSync } = await import('lowdb/node');
  const adapter = new JSONFileSync('db.json');
  const db = new LowSync(adapter, { syncs: {} });
  db.read();
  const { default: Watcher } = await import('watcher');
  const watcher = new Watcher(folder);
  watcher.on('add', (filepath) => {
    console.log(filepath);
    fs.stat(filepath, (err, stat) => {
      if (err) {
        logger.error(err);
        return;
      }
      const lastmod = db.data.syncs[filepath];
      if (lastmod === stat.mtimeMs) {
        logger.info('Already synced');
        return;
      }
      promptStore.addDocument(filepath);
      db.data.syncs[filepath] = stat.mtimeMs;
      db.write();
    });
  });
  process.stdin.resume();
  if (process.platform === 'win32') {
    const r1 = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    r1.on('SIGINT', () => {
      process.emit('SIGINT');
    });
  }
  process.on('SIGINT', () => {
    process.exit();
  });
}

function cli() {
  vorpal
    .command('watch <folder>', "Watches a folder")
    .autocomplete(fsAutocomplete({ directory: true }))
    .action((args, callback) => {
      watch(args.folder);
    });

  splash().then(() => {
    vorpal
      .delimiter('>')
      .show();
  });
}

module.exports = { PromptStore, cli, logger };