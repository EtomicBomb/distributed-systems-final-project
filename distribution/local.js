const http = require('http');
const path = require('node:path');
const process = require('node:process');
const childProcess = require('node:child_process');
const fs = require('node:fs');

const serialization = require('./serialization');
const id = require('./id');
const wire = require('./wire');
const util = require('./util');

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
    this.server.close();
    setTimeout(() => {
      callback(null, global.nodeConfig);
      process.exit();
    }, 100); // give the server enough time to close
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
    const correctPath = path.join(__dirname, '../distribution.js');
    childProcess.spawn(correctPath, ['--config', config], {
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
  };
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
      callback(new Error(`get: could not find: ${gid}`, null));
      return;
    }
    callback(null, group);
  };
  this.putInDistribution = (gid) => {
    if (global.distribution[gid] !== undefined) {
      return;
    }
    global.distribution[gid] = Object.fromEntries(
        Object.entries(global.distribution.all)
            .map(([k, v]) => [k, v({gid})]),
    );
  };
  this.put = (gid, group, callback) => {
    gid = gid.gid || gid;
    this.gidToGroup.set(gid, group);
    this.putInDistribution(gid);
    callback(null, group);
  };
  this.add = (gid, node, callback) => {
    if (!this.gidToGroup.has(gid)) {
      this.gidToGroup.set(gid, {});
      this.putInDistribution(gid);
    }
    const group = this.gidToGroup.get(gid);
    group[id.getSID(node)] = node;
    callback(null, group);
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
  this.recv = (mid, {service, method}, message, gidConfig, callback) => {
    if (this.received.has(mid)) {
      return;
    }
    this.received.add(mid);
    global.distribution.local.routes.get(service, (e, service) => {
      if (e) {
        callback(e, null);
        return;
      }
      if (service[method] === undefined) {
        callback(new Error(`could not find method ${method}`), null);
        return;
      }
      global.distribution.all.gossip(gidConfig)
          .send(message, {service, method}, () => {});
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
      if (errorFlag) {
        return;
      }
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

function Mem() {
  this.store = new Map();
  this.gidKey = (gidKey) => {
    const gid = gidKey.gid === undefined ? 'all' : gidKey.gid;
    const key = gidKey.key === undefined ? gidKey : gidKey.key;
    return {gid, key};
  };
  this.get = (gidKey, callback) => {
    const {gid, key} = this.gidKey(gidKey);
    if (!this.store.has(gid)) {
      callback(new Error(`could not find gid ${gid}`), null);
      return;
    }
    const gidStore = this.store.get(gid);
    if (key === null) {
      callback(null, [...gidStore.keys()]);
      return;
    }
    if (!gidStore.has(key)) {
      callback(new Error(`could not find key ${key}`), null);
      return;
    }
    callback(null, gidStore.get(key));
  };
  this.put = (value, gidKey, callback) => {
    const {gid, key} = this.gidKey(gidKey);
    key = util.getActualKey(key, value);
    if (!this.store.has(gid)) {
      this.store.set(gid, new Map());
    }
    this.store.get(gid).set(key, value);
    callback(null, key);
  };
  this.del = (gidKey, callback) => {
    const {gid, key} = this.gidKey(gidKey);
    if (!this.store.has(gid)) {
      callback(new Error(`could not find gid ${gid}`), null);
      return;
    }
    const actuallyRemoved = this.store.get(gid).delete(key);
    if (!actuallyRemoved) {
      callback(new Error(`could not find ${key}`), null);
      return;
    }
    callback(null, null);
  };
}

function Store() {
  const head = path.join(
      __dirname,
      '..',
      'store',
      id.getNID(global.nodeConfig),
  );
  fs.mkdirSync(head, {recursive: true});
  this.getLocation = (key) => {
    let gid = key.gid === undefined ? 'all' : key.gid;
    key = key.key === undefined ? key : key.key;
    key = Buffer.from(key).toString('hex');
    return path.join(head, gid, key);
  };
  this.get = (key, callback) => {
    fs.readFile(this.getLocation(key), (err, value) => {
      if (err) {
        callback(new Error(`could not get ${key}`, {cause: err}), null);
        return;
      }
      callback(null, serialization.deserialize(value));
    });
  };
  this.put = (value, key, callback) => {
    key = util.getActualKey(key, value);
    value = serialization.serialize(value);
    fs.writeFile(this.getLocation(key), value, (err) => {
      if (err) {
        callback(new Error(`could not put ${key}`, {cause: err}), null);
        return;
      }
      callback(null, key);
    });
  };
  this.del = (key, callback) => {
    fs.unlink(this.getLocation(key), (err) => {
      if (err) {
        callback(new Error(`could not delete ${key}`, {cause: err}), null);
        return;
      }
      callback(null, null);
    });
  };
}

routes.status = new Status();
routes.groups = new Groups();
routes.gossip = new Gossip();
routes.routes = new Routes();
routes.comm = new Comm();
routes.rpc = new RPC();
routes.mem = new Mem();
routes.store = new Store();

module.exports = routes;
