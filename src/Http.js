const Fs = require('fs');
const Path = require('path');
const Request = require('request');
const FileCookieStore = require('tough-cookie-file-store');
const ENDPOINT = require('../resources/Endpoint');
const EPIC_LAUNCHER_AUTHORIZATION = require('../resources/LauncherAuthorization');

class Http {

  constructor(launcher) {

    this.launcher = launcher;
    
    const lastSessionCookiesFile = Path.join(this.launcher.config.storage, 'lastSessionCookies.json');
    if (!this.launcher.config.rememberLastSession && Fs.existsSync(lastSessionCookiesFile)) {
      Fs.unlinkSync(lastSessionCookiesFile);
    }
    this.jar = Request.jar(new FileCookieStore(lastSessionCookiesFile));

    this.options = {

      timeout: 30000,
      headers: {},

      ...this.launcher.config.http,

    };

    this.options.jar = this.jar;

    this.request = Request.defaults(this.options);

  }

  getUserAgent() {
    return `EpicGamesLauncher/${this.launcher.config.build} ${this.launcher.config.platform.os}`;
  }

  setHeader(name, value) {
    this.options.headers[name] = value;
  }

  removeHeader(name) {
    delete this.options.headers[name];
  }

  getHeader(name) {
    return this.options.headers[name];
  }

  send(method, url, auth, data, isJsonResponse, headers, isJsonData) {

    if (typeof isJsonResponse !== 'boolean') isJsonResponse = true;

    return new Promise((resolve, reject) => {
            
      const options = {
        ...this.options,
        url,
      };
            
      options.method = method;
            
      if (auth) {
        if (auth === 'launcher') options.headers.Authorization = `basic ${EPIC_LAUNCHER_AUTHORIZATION}`;
        else options.headers.Authorization = auth;
      }

      if (data) {
        if (isJsonData) {
          options.headers['Content-Type'] = 'application/json';
          options.body = data;
        } else options.form = data;
      }
      if (isJsonResponse) options.json = isJsonResponse;

      options.headers['User-Agent'] = this.getUserAgent();
      if (typeof headers === 'object') options.headers = { ...options.headers, ...headers };

      this.request(options, (err, response, body) => {

        if (err) {
          
          reject(err);
          return;

        }

        if (typeof body === 'object' && typeof body.errorCode !== 'undefined') {

          let error;

          switch (body.errorCode) {

            case 'errors.com.epicgames.common.oauth.invalid_token':
              error = new Error('You aren\'t logged in!');
              break;

            case 'errors.com.epicgames.purchase.purchase.captcha.challenge':
              error = new Error('You need to solve CAPTCHA!');
              break;

            default: {
              // eslint-disable-next-line no-console
              if (process.env.KYSUNE) console.dir(body);
              error = new Error(body.errorCode);
            } break;

          }

          error.response = response;
          reject(error);

          return;

        }

        resolve({
          response,
          data: body,
        });

      });

    });

  }

  sendGet(url, auth, data, isJsonResponse, headers) {
    return this.send('GET', url, auth, data, isJsonResponse, headers);
  }

  sendPost(url, auth, data, isJsonResponse, headers, isJsonData) {
    return this.send('POST', url, auth, data, isJsonResponse, headers, isJsonData);
  }

  sendGraphQL(auth, query, variables, headers) {
    const data = JSON.stringify({
      query,
      variables
    });

    return this.send('POST', ENDPOINT.GRAPHQL, auth, data, false, headers, true);
  }
}

module.exports = Http;
