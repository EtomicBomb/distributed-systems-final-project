const http = require('node:http');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const process = require('node:process');
const {unlink, readdir, mkdir, writeFile, readFile} = require('node:fs/promises');
const childProcess = require('node:child_process');
const fs = require('node:fs');

const {putInDistribution} = require('./all');
const util = require('./util/util');

function Status() {
  this.counts = 0;
  this.server = null;
  this.incrementCount = () => {
    this.counts += 1;
  };
  this.get = async (installation) => {
    const getter = {
      nid: () => util.id.getNID(global.nodeConfig),
      sid: () => util.id.getSID(global.nodeConfig),
      ip: () => global.nodeConfig.ip,
      port: () => global.nodeConfig.port,
      counts: () => this.counts,
      heapTotal: () => process.memoryUsage().heapTotal,
      heapUsed: () => process.memoryUsage().heapUsed,
    }[installation];
    if (getter === undefined) {
      throw new Error(`could not identify ${installation}`);
    }
    return getter.call(this);
  };
  this.stop = async (closeToken, node) => {
    throw new Error('handleClose');
  };
  this.spawn = async (config) => {
    config = config || {};
    let resolve;
    const promise = new Promise((res) => {
      resolve = res;
    });
    const localOnStart = config.onStart || (() => {});
    config.onStart = util.wire.asyncRPC((server, node) => {
      localOnStart();
      resolve(node);
    });
    config = util.serialize(config);
    const correctPath = path.join(__dirname, '../distribution.js');
    childProcess.spawn('node', [correctPath, '--config', config], {
      stdio: 'inherit',
    }).on('error', (e) => console.error('spawn error', e));
    const node = await promise;
    await util.sendToAll({
      message: [node],
      service: 'groups',
      method: 'registerKnownNode',
      gid: 'all',
      exclude: null,
      subset: null,
    });
    return node;
  };
};

function Groups() {
  this.gidToGroup = new Map();
  this.all = {};
  this.registerKnownNode = async (node) => {
    this.all[util.id.getSID(node)] = node;
  };
  this.get = async (gid) => {
    if (gid === 'local') {
      return {[util.id.getSID(global.nodeConfig)]: global.nodeConfig};
    }
    if (gid === 'all') {
      return this.all;
    }
    let group = this.gidToGroup.get(gid);
    if (group === undefined) {
      throw new Error(`get: could not find: ${gid}`);
    }
    return group;
  };
  this.put = async (gidConfig, group) => {
    const gid = gidConfig.gid || gidConfig;
    this.gidToGroup.set(gid, group);
    putInDistribution(gidConfig);
    return group;
  };
  this.add = async (gidConfig, node) => {
    const gid = gidConfig.gid || gidConfig;
    if (!this.gidToGroup.has(gid)) {
      this.gidToGroup.set(gid, {});
      putInDistribution(gidConfig);
    }
    const group = this.gidToGroup.get(gid);
    group[util.id.getSID(node)] = node;
    return group;
  };
  this.rem = async (gid, sid) => {
    const removeFrom = this.gidToGroup.get(gid);
    if (removeFrom === undefined) {
      throw new Error(`could not find: ${gid}`);
    }
    delete removeFrom[sid];
    return removeFrom;
  };
  this.del = async (gid) => {
    const group = this.gidToGroup.get(gid);
    if (group === undefined) {
      throw new Error(`group ${gid} does not exist`);
    }
    this.gidToGroup.delete(gid);
    return group;
  };
};

function Gossip() {
  this.received = new Set();
  this.recv = async (mid, {service, method}, message, gid) => {
    if (this.received.has(mid)) {
      return;
    }
    this.received.add(mid);
    // no await
    distribution[gid].async.gossip.sendMID(mid, message, {service, method});
    service = await distribution.local.async.routes.get(service);
    const [e, v] = await new Promise((resolve) =>
      service[method].call(service, ...message, resolve));
    if (isError(e)) {
      throw e;
    }
    return v;
  };
};

function Routes() {
  this.customRoutes = new Map();
  this.put = async (service, name) => {
    this.customRoutes.set(name, service);
    return service;
  };
  this.get = async (name) => {
    if (distribution.local[name] !== undefined) {
      return distribution.local[name];
    }
    if (this.customRoutes.has(name)) {
      return this.customRoutes.get(name);
    }
    throw new Error(`could not identify route ${name}`);
  };
};

function isError(e) {
  if (!e) {
    return false;
  }
  const isEmptyObject =
        typeof e === 'object' &&
        Object.keys(e).length === 0 &&
        !(e instanceof Error);
  if (isEmptyObject) {
    return false;
  }
  return true;
}

function HandleClose() {
  this.installed = new Map();
  this.promise = () => {
    const closeToken = randomUUID();
    const donePromise = new Promise((res) => this.installed.set(closeToken, res));
    return {message: [closeToken, global.nodeConfig], donePromise};
  };
  this.handleClose = async (closeToken) => {
    this.installed.get(closeToken)();
  };
}

// A message communication interface
function Comm() {
  this.send = async (message, {node, service, method}) => {
    const options = {
      host: node.ip,
      port: node.port,
      path: `/${service}/${method}`,
      method: 'POST',
      headers: {'Content-type': 'application/json', 'Connection': 'close'},
    };
    let donePromise = Promise.resolve();
    if (service === 'status' && method === 'stop') {
      // we have to wait till the server tells us it stopped
      ({message, donePromise} = distribution.local.async.handleClose.promise());
    }
    message = util.serialize(message);
    let body = [];
    await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        res.on('data', (chunk) => body.push(chunk));
        res.on('end', resolve);
      });
      req.on('error', (e) => reject(new Error('request send', {cause: e})));
      req.write(message);
      req.end();
    });
    body = Buffer.concat(body).toString();
    const [e, v] = util.deserialize(body, (expr) => eval(expr));
    if (isError(e)) {
      throw e;
    }
    await donePromise;
    return v;
  };
}

function RPC() {
  this.installed = [];
  this.call = async (args, installation) => {
    return await this.installed[installation](...args);
  };
  this.install = (func) => {
    const installation = this.installed.length;
    this.installed.push(func);
    return installation;
  };
};

function MapReduceMapper() {
  this.map = async (map, job, gid, hash, key1, memOrStore) => {
    const value1 = await distribution.local.async[memOrStore].get({gid, key: key1});
    let results = await Promise.resolve(map(key1, value1));
    results = Array.isArray(results) ? results : [results];
    results = results.map((result) => Object.entries(result).flat());
    await Promise.all(results.map(([key2, value2]) => util.callOnHolder({
      key: key2,
      value: null,
      gid,
      hash,
      message: [job, key2, value2, memOrStore],
      service: 'mapReduceReducer',
      method: 'shuffle',
    })));
  };
}

function MapReduceReducer() {
  this.jobToKey2ToValue2s = new Map();
  this.shuffle = async (job, key2, value2, memOrStore) => {
    if (!this.jobToKey2ToValue2s.has(job)) {
      this.jobToKey2ToValue2s.set(job, new Map());
    }
    const key2ToValue2s = this.jobToKey2ToValue2s.get(job);
    if (!key2ToValue2s.has(key2)) {
      key2ToValue2s.set(key2, []);
    }
    key2ToValue2s.get(key2).push(value2);
  };
  this.reduce = async (job, reduce) => {
    const key2ToValue2s = this.jobToKey2ToValue2s.get(job) || [];
    return await Promise.all([...key2ToValue2s].map(([key2, value2s]) =>
      Promise.resolve(reduce(key2, value2s)),
    ));
  };
}

function getGidKey(gidKey) {
  const gid = !gidKey || gidKey.gid === undefined ? 'all' : gidKey.gid;
  const key = !gidKey || gidKey.key === undefined ? gidKey : gidKey.key;
  return {gid, key};
}

function Mem() {
  this.store = new Map();
  this.get = async (gidKey) => {
    const {gid, key} = getGidKey(gidKey);
    if (!this.store.has(gid)) {
      throw new Error(`could not find gid ${gid}`);
    }
    const gidStore = this.store.get(gid);
    if (key === null) {
      return [...gidStore.keys()];
    }
    if (!gidStore.has(key)) {
      throw new Error(`could not find key ${key}`);
    }
    return gidStore.get(key);
  };
  this.put = async (value, gidKey) => {
    let {gid, key} = getGidKey(gidKey);
    key = util.getActualKey(key, value);
    if (!this.store.has(gid)) {
      this.store.set(gid, new Map());
    }
    this.store.get(gid).set(key, value);
    return value;
  };
  this.del = async (gidKey) => {
    const {gid, key} = getGidKey(gidKey);
    if (!this.store.has(gid)) {
      throw new Error(`could not find gid ${gid}`);
    }
    const gidStore = this.store.get(gid);
    if (!gidStore.has(key)) {
      throw new Error(`could not find key ${key}`);
    }
    const ret = gidStore.get(key);
    gidStore.delete(key);
    return ret;
  };
}

function Store() {
  const getLocationHead = (gid) => path.join(
      __dirname,
      '../store/store',
      util.id.getNID(global.nodeConfig),
      gid,
  );
  const getAll = async (gid) => {
    let paths;
    try {
      paths = await readdir(getLocationHead(gid));
    } catch (e) {
      paths = [];
    }
    return paths.map((key) => decodeURIComponent(key));
  };
  const getLocation = async (key, gid, create) => {
    const head = getLocationHead(gid);
    if (create) {
      await mkdir(head, {recursive: true});
    }
    key = encodeURIComponent(key);
    return path.join(head, key);
  };
  this.get = async (gidKey) => {
    let {gid, key} = getGidKey(gidKey);
    if (key === null) {
      return await getAll(gid);
    }
    let value;
    try {
      value = await readFile(await getLocation(key, gid, false));
    } catch (e) {
      throw new Error(`could not find ${e}`, {cause: e});
    }
    return util.deserialize(value, (expr) => eval(expr));
  };
  this.put = async (value, gidKey) => {
    let {gid, key} = getGidKey(gidKey);
    key = util.getActualKey(key, value);
    await writeFile(await getLocation(key, gid, true), util.serialize(value));
    return value;
  };
  this.del = async (gidKey) => {
    const ret = await this.get(gidKey);
    let {gid, key} = getGidKey(gidKey);
    await unlink(await getLocation(key, gid, false));
    return ret;
  };
}

const routes = {
  status: new Status(),
  groups: new Groups(),
  gossip: new Gossip(),
  routes: new Routes(),
  comm: new Comm(),
  rpc: new RPC(),
  mem: new Mem(),
  store: new Store(),
  mapReduceMapper: new MapReduceMapper(),
  mapReduceReducer: new MapReduceReducer(),
  handleClose: new HandleClose(),
};

function mapValues(x, func) {
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, func(v)]));
}

function serviceToCallbackService(service) {
  return mapValues(service, (method) => (...args) => {
    if (args.length === method.length + 1) {
      const callback = args.pop();
      Promise.resolve(method.call(service, ...args))
          .then((v) => callback(null, v))
          .catch((e) => callback(e, null));
    } else if (args.length === method.length) {
      console.trace(`did not provide a callback for ${method.toString()}`);
      // they did not the callback, ignore the promise
      method.call(service, ...args);
    } else {
      throw new Error(`wrong number of arguments for ${method.toString()}: found ${args.length}, expected ${method.length} ${args}`);
    }
  });
}

module.exports = {
  ...mapValues(routes, serviceToCallbackService),
  async: routes,
};
