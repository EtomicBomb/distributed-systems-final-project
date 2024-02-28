const serialization = require('./serialization');
const id = require('./id');
const wire = require('./wire');

function defaultGIDConfig(gidConfig) {
  gidConfig = gidConfig || {};
  gidConfig.gid = gidConfig.gid || 'all';
  gidConfig.subset = gidConfig.subset || ((lst) => 3);
  return gidConfig;
}

function sendToAll({message, service, method, callback, gid, exclude, subset}) {
  if (service === undefined || method === undefined) {
    callback(new Error(`missing node, service, or method`), null);
    return;
  }
  distribution.local.groups.get(gid, (e, nodes) => {
      console.trace(nodes);
    nodes = Object.values(nodes).filter((node) => id.getSID(node) !== exclude);
    if (subset) {
      const newNodes = [];
      subset = subset(nodes);
      while (newNodes.length < subset) {
        const index = Math.floor(nodes.length * Math.random());
        newNodes.push(...nodes.splice(index, 1));
      }
      nodes = newNodes;
    }
    let sidToValue = {};
    let sidToError = {};
    let responses = 0;
    if (nodes.length === 0) {
      callback(sidToError, sidToValue);
      return;
    }
      console.trace(nodes);
    for (const node of nodes) {
      const sid = id.getSID(node);
      distribution.local.comm.send(message, {node, service, method}, (e, v) => {
        if (e !== null) {
          sidToError[sid] = e;
        }
        if (v !== null) {
          sidToValue[sid] = v;
        }
        responses += 1;
        if (responses < nodes.length) {
          return;
        }
        callback(sidToError, sidToValue);
      });
    }
  });
}

module.exports = {
  serialize: serialization.serialize,
  deserialize: serialization.deserialize,
  defaultGIDConfig,
  sendToAll,
  id: id,
  wire: wire,
};
