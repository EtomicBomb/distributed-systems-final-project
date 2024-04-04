const util = require('../util/util.js');

function Comm(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.send = (message, {service, method}, callback) => {
    util.sendToAll({
      message,
      service,
      method,
      gid: gidConfig.gid,
      exclude: null,
      subset: null,
    }).then(([es, vs]) => callback(es, vs));
  };
}

module.exports = (...args) => new Comm(...args);
