const util = require('../util');
const id = require('../id');

function Status(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.get = (installation, callback) => {
    util.sendToAll({
      message: [installation],
      service: 'status',
      method: 'get',
      gid: gidConfig.gid,
      exclude: null,
      subset: null,
      callback: (e, v) => {
        if (v === undefined || v === null) {
          callback(e, null);
          return;
        }
        const shouldAggregate = ['counts', 'heapTotal', 'heapUsed']
            .includes(installation);
        if (shouldAggregate) {
          v = Object.values(v).reduce((acc, elem) => acc + elem, 0);
        }
        callback(e, v);
      },
    });
  };
  this.stop = (callback) => {
    util.sendToAll({
      message: [],
      service: 'status',
      method: 'stop',
      gid: gidConfig.gid,
      exclude: id.getSID(global.nodeConfig),
      subset: null,
      callback: (e, v) => {
        if (e) {
          callback(e, null);
          return;
        }
        global.distribution.local.status.stop(callback);
      },
    });
  };
  this.spawn = (config, callback) => {
    global.distribution.local.status.spawn(config, (e, node) => {
      if (e) {
        callback(e, null);
        return;
      }
      const gid = gidConfig.gid;
        require('../../distribution/all/groups')(gidConfig)
            .add(gid, node, (e, v) => {
        if (Object.keys(e).length > 0) {
          callback(e, null);
          return;
        }
        callback(null, node);
      });
    });
  };
}

module.exports = (...args) => new Status(...args);
