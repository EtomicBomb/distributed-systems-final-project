const http = require('http');

const serialization = require('../util/serialization');
const id = require('../util/id');

const node = global.config;

const routes = {};

const Status = {
  counts: 0,
  incrementCount() {
    this.counts += 1;
  },
  get(installation, callback) {
    let getter = {
      nid: () => id.getNID(node),
      sid: () => id.getSID(node),
      ip: () => node.ip,
      port: () => node.port,
      counts: () => this.counts,
    };
    getter = getter[installation];
    if (getter === undefined) {
      callback(new Error(`could not identify ${installation}`), null);
      return;
    }
    getter = getter.bind(this);
    callback(null, getter());
  },
};

// A mapping from names to functions
const Routes = {
  put(service, name, callback) {
    routes[name] = service;
    callback(null, service);
  },
  get(name, callback) {
    let service;
    service = routes[name];
    if (service !== undefined) {
      callback(null, service);
      return;
    }
    callback(new Error(`could not identify route ${name}`), null);
  },
};

// A message communication interface
const Comm = {
  send(message, {node, service, method}, callback) {
    if (node === undefined || service === undefined || method === undefined) {
      callback(new Error(`missing node, service, or method `), null);
      return;
    }
    const options = {
      host: node.ip,
      port: node.port,
      path: `/${service}/${method}`,
      method: 'POST',
      headers: {'Content-type': 'application/json'},
    };
    const req = http.request(options, (res) => {
      let body = [];
      res.on('data', (chunk) => {
        body.push(chunk);
      });
      res.on('end', () => {
        body = Buffer.concat(body).toString();
        callback(...serialization.deserialize(body));
      });
    });
    req.on('error', (e) => {
      callback(new Error('request send error', {cause: e}), null);
    });
    req.write(serialization.serialize(message));
    req.end();
  },
};

const RPC = {
  installed: [],
  get(installation) {
    return this.installed[installation];
  },

  call(args, installation, callback) {
    if (args === undefined || installation === undefined) {
      callback(new Error(`missing args or installation`), null);
    }
    this.get(installation)(...args, callback);
  },
  install(func) {
    const installation = this.installed.length;
    this.installed.push(func);
    return installation;
  },
};

routes.status = Status;
routes.routes = Routes;
routes.comm = Comm;
routes.rpc = RPC;

module.exports = routes;
