const util = require('../util');
const id = require('../id');
const crypto = require('node:crypto');

function callOnHolder(
    {key, value, gid, hash, message, service, method, callback},
) {
  distribution.local.groups.get(gid, (e, nodes) => {
    if (e) {
      callback(e, null);
      return;
    }

    nodes = Object.values(nodes);
    nodes = nodes.map((node) => [id.getNID(node), node]);
    nodes = Object.fromEntries(nodes);

      const kid = id.getID(value === null ? key : util.getActualKey(key, value));

      const nid = hash(kid, Object.keys(nodes));
    const node = nodes[nid];

    distribution.local.comm.send(
        message,
        {node, service, method},
        callback,
    );
  });
}

function MemStore(service, gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
    const augment = (gidKey) => {
        const key = !gidKey || gidKey.key === undefined ? gidKey : gidKey.key;
        const gid = !gidKey || gidKey.gid === undefined ? gidConfig.gid : gidKey.gid;
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
        callback: (e, v) => {
          callback(e, Object.values(v).flat());
        },
      });
    } else {
      callOnHolder({
        key,
        value: null,
        gid: gidConfig.gid,
        hash: gidConfig.hash,
        message: [augment(key)],
        service,
        method: 'get',
        callback,
      });
    }
  };
  this.put = (value, key, callback) => {
    callOnHolder({
      key,
      value,
      gid: gidConfig.gid,
      hash: gidConfig.hash,
      message: [value, augment(key)],
      service,
      method: 'put',
      callback,
    });
  };
  this.del = (key, callback) => {
    callOnHolder({
      key,
      value: null,
      gid: gidConfig.gid,
      hash: gidConfig.hash,
      message: [augment(key)],
      service,
      method: 'del',
      callback,
    });
  };
  this.reconf = (group, callback) => {
    callback(new Error('not implemented'), null);
  };
}

module.exports = MemStore;
