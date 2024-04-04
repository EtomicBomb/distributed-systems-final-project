const http = require('node:http');
const path = require('node:path');
const process = require('node:process');
const childProcess = require('node:child_process');
const fs = require('node:fs');

const util = require('./util/util.js');

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
      nid: () => util.id.getNID(global.nodeConfig),
      sid: () => util.id.getSID(global.nodeConfig),
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
    config.onStart = util.wire.createRPC(util.wire.toAsync((server, node) => {
      global.distribution.local.groups.registerKnownNode(node);
      localOnStart();
      localCallback(null, node);
    }));
    config = util.serialize(config);
    const correctPath = path.join(__dirname, '../distribution.js');
    childProcess.spawn('node', [correctPath, '--config', config], {
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
    this.all[util.id.getSID(node)] = node;
  };
  this.registerKnownNode(global.nodeConfig);
  this.get = (gid, callback) => {
    callback = callback || function() {};
    if (gid === 'local') {
      callback(null, {[util.id.getSID(global.nodeConfig)]: global.nodeConfig});
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
  this.putInDistribution = (gidConfig) => {
    const gid = gidConfig.gid || gidConfig;
    if (global.distribution[gid] !== undefined) {
      return;
    }
    global.distribution[gid] = Object.fromEntries(
        Object.entries(require('../distribution/all'))
            .map(([k, v]) => [k, v(gidConfig)]),
    );
  };
  this.put = (gidConfig, group, callback) => {
    callback = callback || function() {};
    const gid = gidConfig.gid || gidConfig;
    this.gidToGroup.set(gid, group);
    this.putInDistribution(gidConfig);
    callback(null, group);
  };
  this.add = (gidConfig, node, callback) => {
    callback = callback || function() {};
    const gid = gidConfig.gid || gidConfig;
    if (!this.gidToGroup.has(gid)) {
      this.gidToGroup.set(gid, {});
      this.putInDistribution(gidConfig);
    }
    const group = this.gidToGroup.get(gid);
    group[util.id.getSID(node)] = node;
    callback(null, group);
  };
  this.rem = (gid, sid, callback) => {
    callback = callback || function() {};
    const removeFrom = this.gidToGroup.get(gid);
    if (removeFrom === undefined) {
      callback(new Error(`could not find: ${gid}`, null));
      return;
    }
    delete removeFrom[sid];
    callback(null, removeFrom);
  };
  this.del = (gid, callback) => {
    callback = callback || function() {};
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
      require('../distribution/all/gossip')(gidConfig)
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
        callback(...util.deserialize(body, (expr) => eval(expr)));
      });
    });
    req.on('error', (e) => {
      if (errorFlag) {
        return;
      }
      errorFlag = true;
      callback(new Error('request send error', {cause: e}), null);
    });
    req.write(util.serialize(message));
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

function MapReduceMapper() {
  this.map = (map, job, gid, hash, key1, memOrStore, callback) => {
    global.distribution.local[memOrStore].get({gid, key: key1}, (e, value1) => {
      if (e) {
        callback(e, null);
        return;
      }
      let results = map(key1, value1);
      results = Array.isArray(results) ? results : [results];
      results = results.map((result) => Object.entries(result).flat());
      let remaining = results.length;
      const errors = [];
      for (const [key2, value2] of results) {
        util.callOnHolder({
          key: key2,
          value: null,
          gid,
          hash,
          message: [job, key2, value2, memOrStore],
          service: 'mapReduceReducer',
          method: 'shuffle',
          callback: (e, v) => {
            remaining -= 1;
            errors.push(e);
            if (remaining > 0) {
              return;
            }
            callback(errors, null);
          },
        });
      };
    });
  };
}

function MapReduceReducer() {
  this.jobToKey2ToValue2s = new Map();
  this.shuffle = (job, key2, value2, memOrStore, callback) => {
    if (!this.jobToKey2ToValue2s.has(job)) {
      this.jobToKey2ToValue2s.set(job, new Map());
    }
    const key2ToValue2s = this.jobToKey2ToValue2s.get(job);
    if (!key2ToValue2s.has(key2)) {
      key2ToValue2s.set(key2, []);
    }
    key2ToValue2s.get(key2).push(value2);
    callback(null, null);
  };
  this.reduce = (job, reduce, callback) => {
    const key2ToValue2s = this.jobToKey2ToValue2s.get(job);
    if (key2ToValue2s === undefined) {
      callback(null, []);
      return;
    }
    let results = [...key2ToValue2s].map(([key2, value2s]) => reduce(key2, value2s));
    callback(null, results);
  };
}

function MapReduceScheduler() {
  this.jobCounter = 0;
  this.jobs = new Map();
  this.createJob = (nodeIDs, callback) => {
    const jobID = this.jobCounter;
    this.jobCounter += 1;

    // create and return an RPC?
    util.wire.createRPC(distribution.util.wire.toAsync(addOne));


    return jobID;
  };
  this.completeJob = (jobID) => {
    this.jobs.delete(jobID);
  };
  this.notify = (jobID, nid, ...message) => {
    const job = this.jobs.get(jobID);
    if (job === undefined) {
      console.trace('job not found');
      return;
    }
    const {callback} = job;
    callback(nid, ...message);
  };
}

function getGidKey(gidKey) {
  const gid = !gidKey || gidKey.gid === undefined ? 'all' : gidKey.gid;
  const key = !gidKey || gidKey.key === undefined ? gidKey : gidKey.key;
  return {gid, key};
}

function Mem() {
  this.store = new Map();
  this.get = (gidKey, callback) => {
    const {gid, key} = getGidKey(gidKey);
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
    let {gid, key} = getGidKey(gidKey);
    key = util.getActualKey(key, value);
    if (!this.store.has(gid)) {
      this.store.set(gid, new Map());
    }
    this.store.get(gid).set(key, value);
    callback(null, value);
  };
  this.del = (gidKey, callback) => {
    const {gid, key} = getGidKey(gidKey);
    if (!this.store.has(gid)) {
      callback(new Error(`could not find gid ${gid}`), null);
      return;
    }
    const gidStore = this.store.get(gid);
    if (!gidStore.has(key)) {
      callback(new Error(`could not find key ${key}`), null);
      return;
    }
    const ret = gidStore.get(key);
    gidStore.delete(key);
    callback(null, ret);
  };
}

function Store() {
  const nid = util.id.getNID(global.nodeConfig);
  this.getLocationHead = (gid) => path.join(__dirname, '..', 'store', 'store', nid, gid);
  const getAll = (gid, nid, callback) => {
    const path = this.getLocationHead(gid, nid);
    fs.readdir(path, {}, (e, v) => {
      if (e) {
        callback(null, []);
        return;
      }
      v = v.map((key) => Buffer.from(key, 'hex').toString());
      callback(null, v);
    });
  };
  this.getLocation = (key, gid, create) => {
    const head = this.getLocationHead(gid, create);
    if (create) {
      fs.mkdirSync(head, {recursive: true});
    }
    key = Buffer.from(key).toString('hex');
    return path.join(head, key);
  };
  this.get = (gidKey, callback) => {
    let {gid, key} = getGidKey(gidKey);
    if (key === null) {
      getAll(gid, nid, callback);
      return;
    }
    fs.readFile(this.getLocation(key, gid, false), (err, value) => {
      if (err) {
        callback(new Error(`could not get ${key}`, {cause: err}), null);
        return;
      }
      callback(null, util.deserialize(value, (expr) => eval(expr)));
    });
  };
  this.put = (value, gidKey, callback) => {
    let {gid, key} = getGidKey(gidKey);
    key = util.getActualKey(key, value);
    fs.writeFile(
        this.getLocation(key, gid, true),
        util.serialize(value),
        (err) => {
          if (err) {
            console.trace(err);
            callback(new Error(`could not put ${key}`, {cause: err}), null);
            return;
          }
          callback(null, value);
        },
    );
  };
  this.del = (gidKey, callback) => {
    this.get(gidKey, (e, ret) => {
      if (e) {
        callback(e, null);
        return;
      }
      let {gid, key} = getGidKey(gidKey);
      fs.unlink(this.getLocation(key, gid, false), (err) => {
        callback(null, ret);
      });
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
routes.mapReduceMapper = new MapReduceMapper();
routes.mapReduceReducer = new MapReduceReducer();
routes.mapReduceScheduler = new MapReduceScheduler();

module.exports = routes;
