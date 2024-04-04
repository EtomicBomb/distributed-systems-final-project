const util = require('../util/util');

function doMap({job, map, gid, hash, memOrStore, key1s, callback}) {
  let remaining = key1s.length;
  const errors = [];
  for (const key1 of key1s) {
    util.callOnHolder({
      key: key1,
      value: null,
      gid,
      hash,
      message: [map, job, gid, hash, key1, memOrStore],
      service: 'mapReduceMapper',
      method: 'map',
      callback: (e, v) => {
        remaining -= 1;
        errors.push(e);
        if (remaining > 0) {
          return;
        }
        callback(errors, null);
      },
    });
  }
}

function doReduce({job, reduce, gid, callback}) {
  util.sendToAll({
    message: [job, reduce],
    service: 'mapReduceReducer',
    method: 'reduce',
    gid,
    exclude: null,
    subset: null,
    callback: (e, v) => {
      v = Object.values(v).flat();
      //        console.trace(v);
      //      v = Object.groupBy(v, ([key3, value3]) => key3);
      //      v = Object.entries(v).map(([key3, [_, value3]]) => [key3, value3]);
      //      v = Object.fromEntries(v);
      callback(e, v);
    },
  });
}

function MapReduce(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.jobsIssued = 0;
  this.exec = ({keys, map, reduce, memory}, callback) => {
    this.jobsIssued += 1;
    const job = `${util.id.getNID(global.nodeConfig)}-${this.jobsIssued}`;
    const memOrStore = memory ? 'mem' : 'store';
    const {gid, hash} = gidConfig;
    doMap({job, map, gid, hash, memOrStore, key1s: keys, callback: (e, v) => doReduce({job, reduce, gid, callback})});
  };
}

module.exports = (...args) => new MapReduce(...args);
