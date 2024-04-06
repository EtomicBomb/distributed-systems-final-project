const http = require('node:http');
const localAsync = require('./localAsync');
const util = require('./util/util');

async function handleConnection(req, server) {
  localAsync.status.incrementCount();
  // http://node_ip:node_port/service/method
  let message = [];
  req.on('data', (chunk) => message.push(chunk));
  await new Promise((resolve) => req.on('end', resolve));
  message = Buffer.concat(message).toString();
  ({message, node} = util.deserialize(message, (expr) => eval(expr)));
  let [, service, method] = req.url.match(/^\/(.*)\/(.*)$/);
  service = await distribution.localAsync.routes.get(service);
  const [e, v] = await new Promise((callback) =>
    service[method].call(service, ...message, (...ev) => callback(ev)));
  if (e instanceof Error && e.message === 'handleClose') {
    const remote = {node, service: 'handleClose', method: 'handleClose'};
    const start = Date.now();
    server.close(() => {
        console.trace('finish close', Date.now() - start);
        localAsync.comm.send(message, remote).then();
    });
    return [null, global.nodeConfig];
  }
  return [e, v];
}

function start(started) {
  const server = http.createServer({keepAliveTimeout: 5000}, (req, res) => {
    handleConnection(req, server)
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
    started(server, global.nodeConfig, (...args) => {});
  });
};

module.exports = {start};
