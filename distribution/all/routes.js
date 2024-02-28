const util = require('../util');

function Routes(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.put = (...args) => {
    const callback = args.pop() || function() {};
    util.sendToAll({
      message: args,
      service: 'routes',
      method: 'put',
      callback,
      gid: gidConfig.gid,
      exclude: null,
      subset: null,
    });
  };
}

module.exports = (...args) => new Routes(...args);
