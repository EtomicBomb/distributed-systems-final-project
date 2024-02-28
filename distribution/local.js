const http = require('http');
const process = require('node:process');
const childProcess = require('node:child_process');

const serialization = require('./serialization');
const id = require('./id');
const wire = require('./wire');

const routes = {};

function Status() {
  this.counts = 0;
  this.server = null;
  this.incrementCount = () => {
    this.counts += 1;
  };
  this.registerServer = (server) => {
    this.server = server;
  };
  this.get = (installation, callback) => {
    let getter;
    getter = {
      nid: () => id.getNID(global.nodeConfig),
      sid: () => id.getSID(global.nodeConfig),
      ip: () => global.nodeConfig.ip,
      port: () => global.nodeConfig.port,
      counts: () => this.counts,
      heapTotal: () => process.memoryUsage().heapTotal,
      heapUsed: () => process.memoryUsage().heapUsed,
    };
    getter = getter[installation];
    if (getter === undefined) {
      callback(new Error(`could not identify ${installation}`), null);
      return;
    }
    getter = getter.bind(this);
    callback(null, getter());
  };
  this.stop = (callback) => {
    if (this.server === null) {
      callback(new Error('no server running'), null);
      return;
    }
    callback(null, 'shutting down');
    const onClose = () => null; // could do something here
    setTimeout(() => {
      this.server.close(onClose);
    }, 500); // could probably be 0
  };
  this.spawn = (config, callback) => {
    config = config || {};
    //    const localConfig = {ip: config.ip, port: config.port};
    const localOnStart = config.onStart || function() {};
    const localCallback = callback || function() {};
    config.onStart = wire.createRPC(wire.toAsync((server, node) => {
        global.distribution.local.groups.registerKnownNode(node);
      localOnStart();
      localCallback(null, node);
    }));
    config = serialization.serialize(config);
    childProcess.spawn('./distribution.js', ['--config', config], {
      stdio: 'inherit',
    }).on('error', (e) => {
      console.error('spawn error', e);
    });
  };
};

function Groups() {
  this.gidToGroup = new Map();
  this.all = {};
    this.registerKnownNode = (node) => {
        this.all[id.getSID(node)] = node;
    }
    this.registerKnownNode(global.nodeConfig); 
  this.get = (gid, callback) => {
    if (gid === 'local') {
      callback(null, {[id.getSID(global.nodeConfig)]: global.nodeConfig});
      return;
    }
    if (gid === 'all') {
      callback(null, this.all);
      return;
    }
    let group = this.gidToGroup.get(gid);
    if (group === undefined) {
      callback(new Error(`could not find: ${gid}`, null));
        return;
    }
    callback(null, group);
  };
  this.put = (gid, group, callback) => {
    if (!this.gidToGroup.has(gid)) {
      this.gidToGroup.set(gid, {});
    }
    let found = this.gidToGroup.get(gid);
    Object.assign(found, group);
    if (global.distribution[gid] === undefined) {
      global.distribution[gid] = Object.fromEntries(
          Object.entries(global.distribution.all)
              .map(([k, v]) => [k, v({gid})]),
      );
    }
    console.trace('put callback', callback);
    callback(null, found);
  };
  this.add = (gid, node, callback) => {
    this.put(gid, {[id.getSID(node)]: node}, callback);
  };
  this.rem = (gid, sid, callback) => {
    const removeFrom = this.gidToGroup.get(gid);
    if (removeFrom === undefined) {
      callback(new Error(`could not find: ${gid}`, null));
      return;
    }
    delete removeFrom[sid];
    callback(null, removeFrom);
  };
  this.del = (gid, callback) => {
      const group = this.gidToGroup.get(gid);
      if (group === undefined) {
    callback(new Error(`group ${gid} does not exist`), null);
          return;
      }
    this.gidToGroup.delete(gid);
    callback(null, group);
  };
};

function Gossip() {
  this.received = new Set();
  this.recv = (mid, {service, method}, message, callback) => {
    if (this.received.has(mid)) {
      return;
    }
    this.received.add(mid);
    local.routes.get(service, (e, service) => {
      if (e) {
        callback(e, null);
        return;
      }
      if (service[method] === undefined) {
        callback(new Error(`could not find method ${method}`), null);
        return;
      }
      service[method].call(service, ...message, callback);
    });
  };
};

// A mapping from names to functions
function Routes() {
  this.put = (service, name, callback) => {
    routes[name] = service;
    callback(null, service);
  };
  this.get = (name, callback) => {
    let service;
    service = routes[name];
    if (service !== undefined) {
      callback(null, service);
      return;
    }
    callback(new Error(`could not identify route ${name}`), null);
  };
};

// A message communication interface
function Comm() {
  this.send = (message, {node, service, method}, callback) => {
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
      let errorFlag = false;
    const req = http.request(options, (res) => {
      let body = [];
      res.on('data', (chunk) => {
        body.push(chunk);
      });
      res.on('end', () => {
          if (errorFlag) {
              return;
          }
        body = Buffer.concat(body).toString();
        callback(...serialization.deserialize(body));
      });
    });
    req.on('error', (e) => {
        errorFlag = true;
        callback(new Error('request send error', {cause: e}), null);
      console.trace('request send error', e);
    });
    req.write(serialization.serialize(message));
    req.end();
  };
}

function RPC() {
  this.installed = [];
  this.get = (installation) => {
    return this.installed[installation];
  };
  this.call = (args, installation, callback) => {
    if (args === undefined || installation === undefined) {
      callback(new Error(`missing args or installation`), null);
    }
    this.get(installation)(...args, callback);
  };
  this.install = (func) => {
    const installation = this.installed.length;
    this.installed.push(func);
    return installation;
  };
};

routes.status = new Status();
routes.groups = new Groups();
routes.gossip = new Gossip();
routes.routes = new Routes();
routes.comm = new Comm();
routes.rpc = new RPC();

module.exports = routes;
