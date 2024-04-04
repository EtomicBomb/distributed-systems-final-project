const util = require('../util/util');

function Routes(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.put = (...args) => {
    const callback = args.pop() || function() {};
    util.sendToAll({
      message: args,
      service: 'routes',
      method: 'put',
      gid: gidConfig.gid,
      exclude: null,
      subset: null,
    }).then(([es, vs]) => callback(es, vs));
  };
}

module.exports = (...args) => new Routes(...args);
