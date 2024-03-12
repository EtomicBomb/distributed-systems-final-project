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

    const kid = crypto.createHash('sha256')
        .update(value === null ? key : util.getActualKey(key, value))
        .digest('hex');

    const node = nodes[hash(kid, Object.keys(nodes))];

    distribution.local.comm.send(
        message,
        {node, service, method},
        callback,
    );
  });
}

function MemStore(service, gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.get = (key, callback) => {
      // if key is null, then run it for all node in the group
      // pass in the context from gidConfig
    callOnHolder({
      key,
      value: null,
      gid: gidConfig.gid,
      hash: gidConfig.hash,
      message: [key],
      service,
      method: 'get',
      callback,
    });
  };
  this.put = (value, key, callback) => {
    callOnHolder({
      key,
      value,
      gid: gidConfig.gid,
      hash: gidConfig.hash,
      message: [value, key],
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
      message: [key],
      service,
      method: 'del',
      callback,
    });
  };
  this.reconf = () => {
  };
}

module.exports = MemStore;
