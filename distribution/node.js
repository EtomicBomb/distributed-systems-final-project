const http = require('node:http');
const localAsync = require('./localAsync');
const util = require('./util/util');

async function handleConnection(req) {
  localAsync.status.incrementCount();
  // http://node_ip:node_port/service/method
  let body = [];
  req.on('data', (chunk) => body.push(chunk));
  await new Promise((resolve) => req.on('end', resolve));
  body = Buffer.concat(body).toString();
  body = util.deserialize(body, (expr) => eval(expr));
  let [, service, method] = req.url.match(/^\/(.*)\/(.*)$/);
  service = await distribution.localAsync.routes.get(service);
;
  return await new Promise((callback) => service[method].call(service, ...body, (...ev) => callback(ev)));
}

function start(started) {
  const server = http.createServer((req, res) => {
    handleConnection(req)
        .then((ev) => {
          res.writeHead(400, {'Content-Type': 'application/json'});
          res.end(util.serialize(ev));
        })
        .catch((e) => {
            console.trace(e);
          res.writeHead(500, {'Content-Type': 'application/json'});
          res.end(util.serialize([e, null]));
        });
  });

  server.listen(global.nodeConfig.port, global.nodeConfig.ip, () => {
    localAsync.status.registerServer(server);
    started(server, global.nodeConfig, (...args) => {});
  });
};

module.exports = { start };
