const util = require('../util');

function Comm(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.send = (message, {service, method}, callback) => {
    util.sendToAll({
      message,
      service,
      method,
      callback,
      gid: gidConfig.gid,
      exclude: null,
      subset: null,
    });
  };
}

module.exports = (...args) => new Comm(...args);
