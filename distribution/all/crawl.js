const util = require('../util/util');
const https = require('node:https');

function getPageContents(url, callback) {
  try {
    url = new URL(url);
  } catch (e) {
    callback(new Error('invalid url', {source: e}), null);
    return;
  }
  let callbackCalled = false;

  https.request(url, (res) => {
    let body = [];
    res
        .on('data', (chunk) => {
          body.push(chunk);
        })
        .on('end', () => {
          body = Buffer.concat(body).toString();
          if (callbackCalled) {
            return;
          }
          callbackCalled = true;
          callback(null, {body, status: res.statusCode});
        });
  })
      .on('error', (e) => {
        if (callbackCalled) {
          return;
        }
        callbackCalled = true;
        callback(e, null);
      })
      .end();
}

function Crawler(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.crawl = (url, memOrStore, callback) => {
    const {gid} = gidConfig;
    getPageContents(url, (e, v) => {
      const {body} = body;
      require(`./${memOrStore}`)(gidConfig)
          .put(body, {key: url, gid}, callback);
    });
  };
}

module.exports = (...args) => new Crawler(...args);
