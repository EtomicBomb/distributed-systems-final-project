const http = require('http');
const serialization = require('./serialization');
const local = require('./local');

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
            callback(new Error(`could not parse json ${body}: ${e}`), null);
            return;
          }
          local.routes.get(service, (e, service) => {
            if (e) {
              callback(e, null);
              return;
            }
            if (service[method] === undefined) {
              callback(new Error(`could not find method ${method}`), null);
              return;
            }
            service[method].call(service, ...body, callback);
          });
        });
  });

  server.listen(global.nodeConfig.port, global.nodeConfig.ip, () => {
    local.status.registerServer(server);
    started(
        server,
        global.nodeConfig,
        (...args) => console.trace('trace start', ...args),
    );
  });
};

module.exports = {
  start: start,
};
