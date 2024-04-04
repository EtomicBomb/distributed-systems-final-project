const util = require('../util/util');

function Groups(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  const augment = (gid) => gid.gid === undefined ?
        {...gidConfig, gid} :
        {...gidConfig, ...gid};
  this.get = (gid, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [gid],
      service: 'groups',
      method: 'get',
      gid: 'all',
      exclude: null,
      subset: null,
    }).then(([es, vs]) => callback(es, vs));
  };
  this.put = (gid, group, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [augment(gid), group],
      service: 'groups',
      method: 'put',
      gid: 'all',
      exclude: null,
      subset: null,
    }).then(([es, vs]) => callback(es, vs));
  };
  this.add = (gid, node, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [gid, node],
      service: 'groups',
      method: 'add',
      gid: 'all',
      exclude: null,
      subset: null,
    }).then(([es, vs]) => callback(es, vs));
  };
  this.rem = (gid, sid, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [gid, sid],
      service: 'groups',
      method: 'rem',
      gid: 'all',
      exclude: null,
      subset: null,
    }).then(([es, vs]) => callback(es, vs));
  };
  this.del = (gid, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [gid],
      service: 'groups',
      method: 'del',
      gid: 'all',
      exclude: null,
      subset: null,
    }).then(([es, vs]) => callback(es, vs));
  };
}

module.exports = (...args) => new Groups(...args);
