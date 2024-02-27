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
  let sidToValue = new Map();
  let sidToError = new Map();
  let responses = 0;
  let nodes = Object.values(local.groups.get(gidConfig.gid));
  if (subset) {
    const newNodes = [];
    subset = subset(nodes);
    while (newNodes.length < subset) {
      const index = Math.floor(nodes.length * Math.random());
      newNodes.push(...nodes.splice(index, 1));
    }
    nodes = newNodes;
  }
  if (nodes.length === 0) {
    callback(null, sidToValue);
    return;
  }
  for (const node of nodes) {
    const sid = id.getSID(node);
    if (exclude === sid) {
      continue;
    }
    local.comm.send(message, {node, service, method}, (e, v) => {
      if (e !== null) {
        sidToError.set(sid, e);
      }
      if (v !== null) {
        sidToValue.set(sid, v);
      }
      responses += 1;
      if (responses < nodes.length) {
        return;
      }
      sidToError = sidToError.size === 0 ? null : sidToError;
      callback(sidToError, sidToValue);
    });
  }
}

module.exports = {
  serialize: serialization.serialize,
  deserialize: serialization.deserialize,
  defaultGIDConfig,
  sendToAll,
  id: id,
  wire: wire,
};
