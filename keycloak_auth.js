const axios = require('axios').default;

class KeycloakAuth {

  constructor(constants, logger) {
    this.constants = constants;
    this.logger = logger;
  }

  async getAccessToken() {
    const host = this.constants.KEYCLOAK_HOST || process.env.KEYCLOAK_HOST;
    const realm = this.constants.PROMPTSTORE_KEYCLOAK_REALM || process.env.PROMPTSTORE_KEYCLOAK_REALM;
    const clientId = this.constants.PROMPTSTORE_KEYCLOAK_CLIENT_ID || process.env.PROMPTSTORE_KEYCLOAK_CLIENT_ID;
    const clientSecret = this.constants.PROMPTSTORE_KEYCLOAK_CLIENT_SECRET || process.env.PROMPTSTORE_KEYCLOAK_CLIENT_SECRET;
    const url = `${host}/realms/${realm}/protocol/openid-connect/token`;
    const grantType = 'client_credentials';

    // this.logger.debug(`curl -vL -H 'Content-Type: application/x-www-form-urlencoded' ${url} -d 'client_id=${clientId}&client_secret=${clientSecret}&grant_type=${grantType}'`);

    const data = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grantType,
    });
    try {
      const res = await axios.post(url, data.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return res.data;
    } catch (err) {
      this.logger.error(err, err.stack);
      throw err;
    }
  }

}

module.exports = {
  KeycloakAuth,
};