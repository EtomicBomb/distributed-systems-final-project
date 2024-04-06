const util = require('../util/util');

async function doMap({job, map, gid, hash, memOrStore, key1s}) {
  await Promise.all(key1s.map((key1) => util.callOnHolder({
    key: key1,
    value: null,
    gid,
    hash,
    message: [map, job, gid, hash, key1, memOrStore],
    service: 'mapReduceMapper',
    method: 'map',
  })));
}

async function doReduce({job, reduce, gid}) {
  const [es, vs] = await util.sendToAll({
    message: [job, reduce],
    service: 'mapReduceReducer',
    method: 'reduce',
    gid,
    exclude: null,
    subset: null,
  });
  return Object.values(vs).flat();
}

function MapReduce(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
  this.jobsIssued = 0;
  this.execAsync = async ({keys, map, reduce, memory}) => {
    this.jobsIssued += 1;
    const job = `${util.id.getNID(global.nodeConfig)}-${this.jobsIssued}`;
    const memOrStore = memory === null ? gidConfig.memOrStore : (memory ? 'mem' : 'store');
    const {gid, hash} = gidConfig;
    await doMap({job, map, gid, hash, memOrStore, key1s: keys});
    return await doReduce({job, reduce, gid});
  };
  this.exec = ({keys, map, reduce, memory}, callback) => {
    this.execAsync({keys, map, reduce, memory})
        .then((v) => callback(null, v))
        .catch((e) => callback(e, null));
  };
}

module.exports = (...args) => new MapReduce(...args);
