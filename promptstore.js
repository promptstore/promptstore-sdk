const FormData = require('form-data');
const fs = require('fs');
const mime = require('mime-types');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { KeycloakAuth } = require('./keycloak_auth');
const { http, setToken } = require('./http');
const { getSearchType, stripEmptyValues } = require('./utils');

class PromptStore {

  constructor({ constants, logger, callback }) {
    this.constants = constants || {};
    this.logger = logger;
    this.url = this.constants.PROMPTSTORE_BASE_URL || process.env.PROMPTSTORE_BASE_URL;
    this.workspaceId = this.constants.WORKSPACE_ID || process.env.WORKSPACE_ID;
    this.functions = {};
    if (process.env.AUTH_METHOD?.toLowerCase() === 'oauth') {
      const auth = new KeycloakAuth(this.constants, logger);
      auth.getAccessToken().then((token) => {
        setToken(token);
        if (typeof callback === 'function') {
          callback();
        }
      });
    }
  }

  addFunction(name, params, contentOnly = false) {
    this[name] = async (args, paramOverrides) => {
      const res = await http.post(`${this.url}/executions/${name}`, {
        args,
        params: { ...params, ...stripEmptyValues(paramOverrides) },
        workspaceId: this.workspaceId,
      });
      const { response } = res.data;
      if (contentOnly) {
        return response.choices[0].message.content;
      }
      return response;
    };
    return this[name].bind(this);
  }

  async execute(name, args, params, contentOnly = false) {
    const res = await http.post(`${this.url}/executions/${name}`, {
      args,
      params,
      workspaceId: this.workspaceId,
    });
    const { response } = res.data;
    if (contentOnly) {
      return response.choices[0].message.content;
    }
    return response;
  }

  async chatCompletion(messages, model, maxTokens, indexName) {
    const res = await http.post(`${this.url}/chat`, { messages, model, maxTokens, indexName });
    return res.data;
  }

  async getFunctionsByTag(tag) {
    const res = await http.get(`${this.url}/functions/tags/${tag}`);
    return res.data;
  }

  async getPromptSets() {
    const res = await http.get(`${this.url}/prompt-sets`);
    return res.data;
  }

  async getWorkspacePromptSets(workspaceId) {
    const res = await http.get(`${this.url}/workspaces/${workspaceId}/prompt-sets`);
    return res.data;
  }

  async getWorkspacePromptSetsBySkill(workspaceId, skill) {
    this.logger.debug(`getWorkspacePromptSetsBySkill [workspaceId=${workspaceId}; skill=${skill}]`);
    try {
      const url = `${this.url}/workspaces/${workspaceId}/prompt-sets?skill=${skill}`;
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      this.logger.debug('error:', err);
      return [];
    }
  }

  async addDocument(filepath) {
    this.logger.debug(`addDocument [filepath=${filepath}]`);
    try {
      const correlationId = uuidv4();
      const filename = path.parse(filepath).base;
      const mimetype = mime.lookup(path.extname(filepath));
      const file = await fs.promises.readFile(filepath);
      file.originalname = filename;
      file.mimetype = mimetype;
      const form = new FormData();
      form.append('sourceId', this.workspaceId);
      form.append('correlationId', correlationId);
      form.append('file', file, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
      const url = `${this.url}/upload/`;
      const res = http.post(url, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      this.logger.debug('File uploaded to document service successfully.');
      // this.logger.debug('res: ', res.data);
    } catch (err) {
      this.logger.log('error', String(err), err.stack);
      throw err;
    }
  }

  async getIndexes() {
    const url = `${this.url}/index`;
    const res = await http.get(url);
    return res.data;
  }

  async getIndex(name) {
    const url = `${this.url}/index/${name}`;
    try {
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      this.logger.debug(String(err));
      return null;
    }
  }

  async createIndex(indexName, schema) {
    const url = `${this.url}/index`;
    await http.post(url, { indexName, schema });
  }

  async indexDocuments(indexName, documents) {
    const url = `${this.url}/documents`;
    await http.post(url, { indexName, documents });
  }

  async dropDocuments(indexName, query, attrs) {
    const ps = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join('&');
    let url = this.url + '/delete-matching?indexName=' + indexName;
    if (query) {
      url += '&q=' + query;
    }
    if (ps) {
      url += '&' + ps;
    }
    await http.delete(url);
  }

  getSearchSchema(schema) {
    const fields = Object.entries(schema).reduce((a, [k, v]) => {
      const flds = Object.entries(v).reduce((b, [key, val]) => {
        b[k.toLowerCase() + '_' + key.toLowerCase()] = {
          type: getSearchType(val.dataType),
        };
        return b
      }, a);
      flds[k.toLowerCase() + '__label'] = {
        type: 'TEXT'
      };
      return flds;
    }, {});
    return fields;
  }

}

module.exports = {
  PromptStore,
};