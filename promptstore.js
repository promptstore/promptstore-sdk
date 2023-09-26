const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const mime = require('mime-types');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { http, setToken } = require('./http');
const { stripEmpty } = require('./utils');

class PromptStore {

  constructor({ logger }) {
    this.logger = logger;
    this.url = process.env.PROMPTSTORE_BASE_URL;
    this.functions = {};
    this.workspaceId = process.env.WORKSPACE_ID;
    if (process.env.AUTH_METHOD?.toLowerCase() === 'oauth') {
      this.getAccessToken().then((token) => {
        // logger.debug('token:', token);
        setToken(token);
      });
    }
  }

  async getAccessToken() {
    const {
      KEYCLOAK_HOST: host,
      PROMPTSTORE_KEYCLOAK_REALM: realm,
      PROMPTSTORE_KEYCLOAK_CLIENT_ID: clientId,
      PROMPTSTORE_KEYCLOAK_CLIENT_SECRET: clientSecret,
    } = process.env;
    const url = `${host}/realms/${realm}/protocol/openid-connect/token`;
    const grantType = 'client_credentials';

    // this.logger.debug(`curl -vL -H 'Content-Type: application/x-www-form-urlencoded' ${url} -d 'client_id=${clientId}&client_secret=${clientSecret}&grant_type=${grantType}'`);

    const data = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grantType,
    });
    try {
      const resp = await axios.post(url, data.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return resp.data;
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  addFunction(name, params, contentOnly = false) {
    this[name] = async (args, paramOverrides) => {
      const res = await http.post(`${this.url}/executions/${name}`, {
        args,
        params: { ...params, ...stripEmpty(paramOverrides) },
        workspaceId: this.workspaceId,
      });
      // this.logger.debug('res:', res.data);
      if (contentOnly) {
        return res.data.content;
      }
      return res.data;
    };
    return this;
  }

  async execute(name, args, params, contentOnly = false) {
    const res = await http.post(`${this.url}/executions/${name}`, {
      args,
      params,
      workspaceId: this.workspaceId,
    });
    // this.logger.debug('res:', res.data);
    if (contentOnly) {
      return res.data.content;
    }
    return res.data;
  }

  async chatCompletion(messages, model, maxTokens) {
    const res = await http.post(`${this.url}/chat`, { messages, model, maxTokens });
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
      // this.logger.debug('url:', url);
      const res = await http.get(url);
      // this.logger.debug('data:', res.data);
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
      const res = axios.post(url, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      this.logger.debug('File uploaded to document service successfully.');
      // this.logger.debug('res: ', res.data);
    } catch (err) {
      this.logger.log('error', String(err));
    }
  }

}

module.exports = {
  PromptStore,
};