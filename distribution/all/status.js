const util = require('../util/util');

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
    }).then(([es, vs]) => {
      if (vs === undefined || vs === null) {
        callback(es, null);
        return;
      }
      const shouldAggregate = ['counts', 'heapTotal', 'heapUsed']
          .includes(installation);
      if (shouldAggregate) {
        vs = Object.values(vs).reduce((acc, elem) => acc + elem, 0);
      }
      callback(es, vs);
    });
  };
  this.stop = (callback) => {
    util.sendToAll({
      message: [],
      service: 'status',
      method: 'stop',
      gid: gidConfig.gid,
      exclude: util.id.getSID(global.nodeConfig),
      subset: null,
    }).then(([es, vs]) => {
      global.distribution.local.status.stop(callback);
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
