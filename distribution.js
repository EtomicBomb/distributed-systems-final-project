#!/usr/bin/env node

const http = require('node:http');

const args = require('yargs').argv;

const util = require('./distribution/util/util');
const local = require('./distribution/local');
const {putInDistribution} = require('./distribution/all');

function optional(key, value) {
    return value === undefined ? {} : {key: value};
}

const nodeConfig = args.config ? util.deserialize(args.config) : {};

global.nodeConfig = {
  ip: '127.0.0.1',
  port: 8080,
  onStart: () => console.log('Node started!'),
    ...optional('ip', args.ip),
    ...optional('port', parseInt(args.port)),
    ...optional('ip', nodeConfig.ip),
    ...optional('port', nodeConfig.port),
    ...optional('onStart', nodeConfig.onStart),
};

async function handleConnection(req, server) {
  local.async.status.incrementCount();
  // http://node_ip:node_port/service/method
  let message = [];
  req.on('data', (chunk) => message.push(chunk));
  await new Promise((resolve) => req.on('end', resolve));
  message = Buffer.concat(message).toString();
  message = util.deserialize(message, (expr) => eval(expr));
  let [, service, method] = req.url.match(/^\/(.*)\/(.*)$/);
  service = await local.async.routes.get(service);
  const [e, v] = await new Promise((callback) =>
    service[method].call(service, ...message, (...ev) => callback(ev)));
  if (e instanceof Error && e.message === 'handleClose') {
    const [closeToken, node] = message;
    const remote = {node, service: 'handleClose', method: 'handleClose'};
    server.close(() => {
        // no await
      local.async.comm.send([closeToken], remote);
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
    started(server);
  });
}

module.exports = global.distribution = {
  util: require('./distribution/util/util'),
  local: require('./distribution/local'),
  node: {start},
};

putInDistribution({gid: 'all'});

/* The following code is run when distribution.js is run directly */
if (require.main === module) {
  start(global.nodeConfig.onStart);
}

