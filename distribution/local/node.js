const http = require('http');
const serialization = require('../util/serialization');
const local = require('../local/local.js');

const start = function(started) {
  const server = http.createServer((req, res) => {
    const callback = (e, v) => {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(serialization.serialize([e, v]));
    };

    if (req.method !== 'POST') {
      callback(new Error('we only accept post requests'), null);
      return;
    }

    local.status.incrementCount(); // XXX

    const serviceMethod = req.url.match(/^\/(.*)\/(.*)$/); // http://node_ip:node_port/service/method

    if (serviceMethod === null) {
      callback(new Error(`could not parse url string ${req.url}`), null);
      return;
    }

    [_, service, method] = serviceMethod;

    let body = [];
    req
        .on('data', function(chunk) {
          body.push(chunk);
        })
        .on('end', function() {
          body = Buffer.concat(body).toString();
          try {
            body = serialization.deserialize(body);
          } catch (e) {
            callback(new Error(`could not parse json ${body}`), null);
            return;
          }
          let handler;
          handler = local[service];
          if (handler === undefined) {
            callback(new Error(`could not find service ${service}`), null);
            return;
          }
          if (handler[method] === undefined) {
            callback(new Error(`could not find method ${method}`), null);
            return;
          }
          handler = handler[method].bind(handler);
          handler(...body, callback);
        });
  });

  server.listen(global.config.port, global.config.ip, () => {
    started(server);
  });
};

module.exports = {
  start: start,
};
