const {promisify} = require('node:util');
const util = require('../util/util');

function MemStore(service, gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  const augment = (gidKey) => {
    const key = !gidKey || gidKey.key === undefined ? gidKey : gidKey.key;
    const gid = !gidKey ||
          gidKey.gid === undefined ? gidConfig.gid : gidKey.gid;
    return {key, gid};
  };
  this.get = (key, callback) => {
    // if key is null, then run it for all node in the group
    // pass in the context from gidConfig
    if (key === null) {
      util.sendToAll({
        message: [augment(null)],
        service,
        method: 'get',
        gid: gidConfig.gid,
        exclude: null,
        subset: null,
      }).then(([es, vs]) => callback(es, Object.values(vs).flat()));
    } else {
      util.callOnHolder({
        key,
        value: null,
        gid: gidConfig.gid,
        hash: gidConfig.hash,
        message: [augment(key)],
        service,
        method: 'get',
      }).then((v) => callback(null, v)).catch((e) => callback(e, null));
    }
  };
  this.put = (value, key, callback) => {
    util.callOnHolder({
      key,
      value,
      gid: gidConfig.gid,
      hash: gidConfig.hash,
      message: [value, augment(key)],
      service,
      method: 'put',
    }).then((v) => callback(null, v)).catch((e) => callback(e, null));
  };
  this.del = (key, callback) => {
    util.callOnHolder({
      key,
      value: null,
      gid: gidConfig.gid,
      hash: gidConfig.hash,
      message: [augment(key)],
      service,
      method: 'del',
    }).then((v) => callback(null, v)).catch((e) => callback(e, null));
  };
  this.reconf = (group, callback) => {
    callback(new Error('not implemented'), null);
  };
}

module.exports = MemStore;
