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
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
  this.put = (gid, group, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [augment(gid), group],
      service: 'groups',
      method: 'put',
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
  this.add = (gid, node, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [gid, node],
      service: 'groups',
      method: 'add',
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
  this.rem = (gid, sid, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [gid, sid],
      service: 'groups',
      method: 'rem',
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
  this.del = (gid, callback) => {
    callback = callback || (() => {});
    util.sendToAll({
      message: [gid],
      service: 'groups',
      method: 'del',
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
}

module.exports = (...args) => new Groups(...args);
