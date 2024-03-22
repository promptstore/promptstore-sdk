const FormData = require('form-data');
const fs = require('fs');
const mime = require('mime-types');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { KeycloakAuth } = require('./keycloak_auth');
const { http, setToken } = require('./http');
const { getSearchType, stripEmptyValues } = require('./utils');

class PromptStore {

  /**
   * 
   * @param {*} param0 - callback when ready
   */
  constructor({ constants, logger, callback }) {
    this.constants = constants || {};
    this.logger = logger;
    this.url = this.constants.PROMPTSTORE_BASE_URL || process.env.PROMPTSTORE_BASE_URL;
    this.workspaceId = this.constants.WORKSPACE_ID || process.env.WORKSPACE_ID;
    this.functions = {};
    const authMethod = this.constants.AUTH_METHOD || process.env.AUTH_METHOD;
    if (authMethod?.toLowerCase() === 'oauth') {
      const auth = new KeycloakAuth(this.constants, logger);
      auth.getAccessToken().then((token) => {
        setToken(token);
        if (typeof callback === 'function') {
          callback();
        }
      });
    }
  }

  /*** execution ************/

  addFunction(name, params, contentOnly = false) {
    this.logger.debug(`addFunction [name=${name}; params=${JSON.stringify(params)}; contentOnly=${contentOnly}]`);
    this[name] = async (args, paramOverrides) => {
      try {
        const url = `${this.url}/executions/${name}`;
        const options = {
          args,
          params: { ...params, ...stripEmptyValues(paramOverrides) },
          workspaceId: this.workspaceId,
        };
        this.logger.debug('url:', url, options);
        const res = await http.post(url, options);
        const { errors, response, responseMetadata } = res.data;
        if (errors) {
          return { errors };
        }
        if (contentOnly) {
          const message = response.choices[0].message;
          if (message.function_call) {
            let json;
            try {
              json = JSON.parse(message.function_call.arguments);
            } catch (err) {
              this.logger.error('error parsing json response:', err.message);
              json = {};
            }
            return json;
          } else {
            return message.content;
          }
        }
        return { response, responseMetadata };
      } catch (err) {
        let message = err.message;
        if (err.stack) {
          message += '\n' + err.stack;
        }
        this.logger.error(message);
        if (err.response?.data?.errors) {
          return err.response.data;
        }
        return { errors: [{ message }] };
      }
    };
    return this[name].bind(this);
  }

  async execute({ name, args, params, contentOnly = false }) {
    this.logger.debug(`execute [name=${name}; args=${JSON.stringify(args)}; params=${JSON.stringify(params)}; contentOnly=${contentOnly}]`);
    try {
      const url = `${this.url}/executions/${name}`;
      const options = {
        args,
        params,
        workspaceId: this.workspaceId,
      };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      const { errors, response, responseMetadata } = res.data;
      if (errors) {
        return { errors };
      }
      if (contentOnly) {
        const message = response.choices[0].message;
        if (message.function_call) {
          let json;
          try {
            json = JSON.parse(message.function_call.arguments);
          } catch (err) {
            this.logger.error('error parsing json response:', err.message);
            json = {};
          }
          return json;
        } else {
          return message.content;
        }
      }
      return { response, responseMetadata };
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async executeComposition({ name, args, params, functions }) {
    this.logger.debug(`executeComposition [name=${name}; args=${JSON.stringify(args)}; params=${JSON.stringify(params)}; functions=${JSON.stringify(functions)}]`);
    try {
      const url = `${this.url}/composition-executions/${name}`;
      const options = {
        args,
        params,
        functions,
        workspaceId: this.workspaceId,
      };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      const { errors, response, responseMetadata } = res.data;
      if (errors) {
        return { errors };
      }
      return { response, responseMetadata };
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async callTool({ name, args, raw }) {
    this.logger.debug(`callTool [name=${name}; args=${JSON.stringify(args)}; raw=${raw}]`);
    try {
      const url = `${this.url}/tool-executions/${name}`;
      const options = { args, raw };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async chatCompletion({ messages, model, maxTokens, indexName }) {
    this.logger.debug(`chatCompletion [messages=${JSON.stringify(messages)}; model=${model}; maxTokens=${maxTokens}; indexName=${indexName}]`);
    try {
      const url = `${this.url}/chat`;
      const options = {
        messages,
        model,
        maxTokens,
        indexName,
        workspaceId: this.workspaceId,
      };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  /*** ************/

  /*** embeddings ************/

  // async getEmbedding({ provider, model, input }) {
  //   this.logger.debug(`getEmbedding [provider=${provider}; model=${model}; input=${input}]`);
  //   try {
  //     const url = `${this.url}/embedding`;
  //     const options = { input, model, provider };
  //     this.logger.debug('url:', url, options);
  //     const res = await http.post(url, options);
  //     const { embedding, usage } = res.data.data[0];
  //     return { embedding, metadata: { usage } };
  //   } catch (err) {
  //     let message = err.message;
  //     if (err.stack) {
  //       message += '\n' + err.stack;
  //     }
  //     this.logger.error(message);
  //     if (err.response?.data?.errors) {
  //       return err.response.data;
  //     }
  //     return { errors: [{ message }] };
  //   }
  // }

  async createEmbeddings(embeddingProvider, embeddingModel, chunks) {
    this.logger.debug(`createEmbeddings [embeddingProvider=${embeddingProvider}; embeddingModel=${embeddingModel}]`);
    try {
      const url = `${this.url}/embeddings/${embeddingProvider}`;
      const options = { chunks, embeddingModel, embeddingProvider };
      this.logger.debug('url:', url);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  /*** ************/

  /*** image generation ************/

  async createImage(prompt, { n, size = '1024x1024' }) {
    this.logger.debug(`createImage [prompt=${prompt}; n=${n}; size=${size}]`);
    try {
      const url = `${this.url}/image-request`;
      const options = {
        sourceId: this.workspaceId,
        prompt,
        size,
        n,
      };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async generateImageVariant(imageUrl, n = 1) {
    this.logger.debug(`createImage [imageUrl=${imageUrl}; n=${n}]`);
    try {
      const url = `${this.url}/gen-image-variant`;
      const options = { imageUrl, n, workspaceId: this.workspaceId };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  /*** ************/

  /*** metadata ************/

  async getFunctionsByTag(tag) {
    this.logger.debug(`getFunctionsByTag [workspaceId=${this.workspaceId}; tag=${tag}]`);
    try {
      const url = `${this.url}/workspaces/${this.workspaceId}/functions/tags/${tag}`;
      this.logger.debug('url:', url);
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async getCompositions() {
    this.logger.debug(`getCompositions [workspaceId=${this.workspaceId}]`);
    try {
      const url = `${this.url}/workspaces/${this.workspaceId}/compositions`;
      this.logger.debug('url:', url);
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async getComposition(id) {
    this.logger.debug(`getCompositions [id=${id}]`);
    try {
      const url = `${this.url}/compositions/${id}`;
      this.logger.debug('url:', url);
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async getPromptSets() {
    this.logger.debug(`getPromptSets []`);
    try {
      const url = `${this.url}/prompt-sets`;
      this.logger.debug('url:', url);
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async getWorkspacePromptSets() {
    this.logger.debug(`getWorkspacePromptSets [workspaceId=${this.workspaceId}]`);
    try {
      const url = `${this.url}/workspaces/${this.workspaceId}/prompt-sets`;
      this.logger.debug('url:', url);
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async getWorkspacePromptSetsBySkill(skill) {
    this.logger.debug(`getWorkspacePromptSetsBySkill [workspaceId=${this.workspaceId}; skill=${skill}]`);
    try {
      const url = `${this.url}/workspaces/${this.workspaceId}/prompt-sets?skill=${skill}`;
      this.logger.debug('url:', url);
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  /*** ************/

  /*** indexing ************/

  async getIndexes() {
    this.logger.debug(`getIndexes [workspaceId=${this.workspaceId}]`);
    try {
      const url = `${this.url}/workspaces/${this.workspaceId}/indexes`;
      this.logger.debug('url:', url);
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  // async getIndex(name) {
  //   this.logger.debug(`getIndex [name=${name}]`);
  //   try {
  //     const url = `${this.url}/index/${name}`;
  //     this.logger.debug('url:', url);
  //     const res = await http.get(url);
  //     return res.data;
  //   } catch (err) {
  //     let message = err.message;
  //     if (err.stack) {
  //       message += '\n' + err.stack;
  //     }
  //     this.logger.error(message);
  //     if (err.response?.data?.errors) {
  //       return err.response.data;
  //     }
  //     return { errors: [{ message }] };
  //   }
  // }

  async getIndex(vectorStoreProvider, indexName) {
    this.logger.debug(`getIndex [vectorStoreProvider=${vectorStoreProvider}; indexName=${indexName}]`);
    try {
      const url = `${this.url}/index/${vectorStoreProvider}/${indexName}`;
      this.logger.debug('url:', url);
      const res = await http.get(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  // async createIndex(indexName, schema) {
  //   this.logger.debug(`createIndex [indexName=${indexName}; schema=${JSON.stringify(schema)}]`);
  //   try {
  //     const url = `${this.url}/index`;
  //     const options = { indexName, schema };
  //     this.logger.debug('url:', url, options);
  //     const res = await http.post(url, options);
  //     return res.data;
  //   } catch (err) {
  //     let message = err.message;
  //     if (err.stack) {
  //       message += '\n' + err.stack;
  //     }
  //     this.logger.error(message);
  //     if (err.response?.data?.errors) {
  //       return err.response.data;
  //     }
  //     return { errors: [{ message }] };
  //   }
  // }

  async createIndex(vectorStoreProvider, indexName, schema, params) {
    this.logger.debug(`createIndex [vectorStoreProvider=${vectorStoreProvider}; indexName=${indexName}; schema=${JSON.stringify(schema)}; params=${JSON.stringify(params)}]`);
    try {
      const url = `${this.url}/index`;
      const options = { indexName, schema, params, vectorStoreProvider };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async dropIndex(vectorStoreProvider, indexName) {
    this.logger.debug(`dropIndex [vectorStoreProvider=${vectorStoreProvider}; indexName=${indexName}]`);
    try {
      const url = `${this.url}/index/${vectorStoreProvider}/${indexName}`;
      this.logger.debug('url:', url);
      const res = await http.delete(url);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
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
      this.logger.debug('url:', url, form);
      const res = http.post(url, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      this.logger.debug('File uploaded to document service successfully.');
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  indexDocuments(indexName, documents) {
    this.logger.debug(`indexDocuments [indexName=${indexName}]`);
    try {
      const url = `${this.url}/documents`;
      this.logger.debug('url:', url);
      http.post(url, { indexName, documents });
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  dropDocuments(indexName, query, attrs) {
    this.logger.debug(`dropDocuments [indexName=${indexName}; query=${query}; attrs=${JSON.stringify(attrs)}]`);
    try {
      const queryParams = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join('&');
      let url = this.url + '/delete-matching?indexName=' + indexName;
      if (query) {
        url += '&q=' + query;
      }
      if (queryParams) {
        url += '&' + queryParams;
      }
      this.logger.debug('url:', url);
      http.delete(url);
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async indexChunks(vectorStoreProvider, chunks, embeddings, params) {
    this.logger.debug(`indexChunks [vectorStoreProvider=${vectorStoreProvider}; params=${JSON.stringify(params)}]`);
    try {
      const url = `${this.url}/chunks/${vectorStoreProvider}/${params.indexName}`;
      const options = { chunks, embeddings, params };
      this.logger.debug('url:', url);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async deleteChunks(vectorStoreProvider, ids, params) {
    this.logger.debug(`deleteChunks [vectorStoreProvider=${vectorStoreProvider}; ids=${ids}; params=${JSON.stringify(params)}]`);
    try {
      const url = `${this.url}/bulk-delete`;
      const options = { ids, params, vectorStoreProvider };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  async deleteChunk(vectorStoreProvider, id, params) {
    this.logger.debug(`deleteChunk [vectorStoreProvider=${vectorStoreProvider}; id=${id}; params=${JSON.stringify(params)}]`);
    try {
      const url = `${this.url}/bulk-delete`;
      const options = { ids: [id], params, vectorStoreProvider };
      this.logger.debug('url:', url, options);
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  /*** ************/

  /*** search ************/

  async search(params) {
    this.logger.debug(`search [params=${JSON.stringify(params)}]`);
    try {
      const url = `${this.url}/search`;
      const options = { ...params, workspaceId: 1 };
      this.logger.debug('url:', url, options);
      // use system workspace for search
      const res = await http.post(url, options);
      return res.data;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  getSearchSchema(schema) {
    this.logger.debug(`getSearchSchema [schema=${JSON.stringify(schema)}]`);
    try {
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
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      this.logger.error(message);
      if (err.response?.data?.errors) {
        return err.response.data;
      }
      return { errors: [{ message }] };
    }
  }

  /*** ************/

}

module.exports = { PromptStore };