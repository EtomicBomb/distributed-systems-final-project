const util = require('../util');
const crypto = require('node:crypto');

function Gossip(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.send = (message, finalRemote, callback) => {
    message = [crypto.randomUUID(), finalRemote, message];
    const service = 'gossip';
    const method = 'recv';
    const gid = gidConfig.gid;
    const subset = gidConfig.subset;
    const exclude = null;
    util.sendToAll({message, service, method, callback, gid, exclude, subset});
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

