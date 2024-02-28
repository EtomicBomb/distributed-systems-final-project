const util = require('../util');

function Groups(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.get = (...args) => {
    const callback = args.pop() || function() {};
    util.sendToAll({
      message: args,
      service: 'groups',
      method: 'get',
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
  this.put = (...args) => {
    const callback = args.pop() || function() {};
    util.sendToAll({
      message: args,
      service: 'groups',
      method: 'put',
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
  this.add = (...args) => {
    const callback = args.pop() || function() {};
    util.sendToAll({
      message: args,
      service: 'groups',
      method: 'add',
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
  this.rem = (...args) => {
    const callback = args.pop() || function() {};
    util.sendToAll({
      message: args,
      service: 'groups',
      method: 'rem',
      callback,
      gid: 'all',
      exclude: null,
      subset: null,
    });
  };
  this.del = (...args) => {
    const callback = args.pop() || function() {};
    util.sendToAll({
      message: args,
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
