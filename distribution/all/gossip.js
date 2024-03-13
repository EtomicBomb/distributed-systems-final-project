const util = require('../util/util.js');
const crypto = require('node:crypto');

function Gossip(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.send = (message, finalRemote, callback) => {
    util.sendToAll({
      message: [crypto.randomUUID(), finalRemote, message, gidConfig],
      service: 'gossip',
      method: 'recv',
      callback,
      gid: gidConfig.gid,
      exclude: null,
      subset: gidConfig.subset,
    });
  };
  this.at = (periodMillis, rpc, callback) => {
    const intervalID = setInterval(() => {
      rpc();
    }, periodMillis);
    callback(null, intervalID);
  };
  this.del = (intervalID, callback) => {
    clearInterval(intervalID);
    callback(null, null);
  };
}

module.exports = (...args) => new Gossip(...args);

