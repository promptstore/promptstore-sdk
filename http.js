const axios = require('axios').default;

function ApiService() {

  const instance = axios.create({
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  let isTokenRefreshing = false;
  let failedQueue = [];
  let state;
  let onRefreshCallback;
  let onExpiryCallback;

  const setToken = (token) => {
    state = token;
    if (typeof onRefreshCallback === 'function') {
      onRefreshCallback(token);
    }
  };

  const onRefresh = (callback) => {
    onRefreshCallback = callback;
  };

  const onExpiry = (callback) => {
    onExpiryCallback = callback;
  };

  const getAccessToken = () => {
    return state?.access_token;
  };

  const getRefreshToken = () => {
    return state?.refresh_token;
  };

  const renewToken = () => {
    const refreshToken = getRefreshToken();
    return getNewToken(refreshToken).then(setToken);
  };

  const getNewToken = async (refreshToken) => {
    const host = process.env.KEYCLOAK_HOST;
    const realm = process.env.KEYCLOAK_REALM;
    const url = `${host}/realms/${realm}/protocol/openid-connect/token`;
    const clientId = process.env.KEYCLOAK_CLIENT_ID;
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
    const grantType = 'refresh_token';

    // console.log(`curl -vL -H 'Content-Type: application/x-www-form-urlencoded' ${url} -d 'client_id=${clientId}&client_secret=${clientSecret}&grant_type=${grantType}&refresh_token=${refreshToken}'`);

    const data = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grantType,
      refresh_token: refreshToken,
    });
    try {
      const res = await axios.post(url, data.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const { access_token, refresh_token } = res.data;
      return {
        accessToken: access_token,
        refreshToken: refresh_token,
      };
    } catch (err) {
      const message = `Error getting new token: ${err}`;
      console.log(message);
      throw new Error(message);
    }
  };

  const processQueue = (error, accessToken) => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(accessToken);
      }
    });
    failedQueue = [];
  };

  // https://thedutchlab.com/blog/using-axios-interceptors-for-refreshing-your-api-token
  // https://stackoverflow.com/questions/57251719/acquiring-a-new-token-with-axios-interceptors
  instance.interceptors.request.use((config) => {
    // console.log('config:', config);

    const accessToken = getAccessToken();

    if (accessToken) {
      config.headers['Authorization'] = 'Bearer ' + accessToken;
    } else {
      config.headers['apikey'] = process.env.PROMPTSTORE_API_KEY;
    }

    return config;

  }, (err) => {
    return Promise.reject(err);
  });

  instance.interceptors.response.use((res) => {
    return res;
  }, (err) => {
    // console.log(err);

    const originalRequest = err.config;

    const status = err?.response?.status;
    if ((status === 401 || status === 403) && !originalRequest._retry) {
      if (isTokenRefreshing) {
        console.log('token is refreshing');

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((accessToken) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;
            return instance(originalRequest);
          })
          .catch((err) => {
            console.log(err, err.stack);
            return err;
          });
      }

      originalRequest._retry = true;
      isTokenRefreshing = true;

      return new Promise((resolve, reject) => {

        const refreshToken = getRefreshToken();

        console.log('get new token');
        getNewToken(refreshToken)
          .then((token) => {
            // console.log('update:', token);

            setToken(token);

            originalRequest.response.config.headers['Authorization'] = 'Bearer ' + token.accessToken;

            instance(originalRequest).then(resolve, reject);
            processQueue(null, token.accessToken);

          })
          .catch((err) => {
            console.log(err, err.stack);
            processQueue(err);
            reject(err);
            if (typeof onExpiryCallback === 'function') {
              onExpiryCallback(err);
            }
          })
          .then(() => {
            isTokenRefreshing = false;
          });
      });
    }

    return Promise.reject(err);
  });

  return {
    http: instance,
    onTokenExpiry: onExpiry,
    onTokenRefresh: onRefresh,
    renewToken,
    setToken,
  };
}

module.exports = ApiService();