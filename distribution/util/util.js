const https = require("node:https");
const { promisify } = require("node:util");
const { JSDOM } = require("jsdom");
const serialization = require("./serialization");
const id = require("./id");

function getActualKey(key, value) {
  return key === null ? id.getID(value) : key;
}

async function whichHashTo(keys, gid, hash) {
  let nodes = await distribution.local.async.groups.get(gid);
  const nids = Object.values(nodes).map((node) => id.getNID(node));
  const result = keys.map((key) => {
    const nid = hash(id.getID(key), nids);
    return { nid, key };
  });
  const ret = new Map(nids.map((node) => [node, []]));
  for (const { nid, key } of result) {
    ret.get(nid).push(key);
  }
  return ret;
}

// sends message to
async function callOnHolder({
  key,
  value,
  gid,
  hash,
  message,
  service,
  method,
}) {
  let nodes = await distribution.local.async.groups.get(gid);

  nodes = Object.values(nodes);
  nodes = nodes.map((node) => [id.getNID(node), node]);
  nodes = Object.fromEntries(nodes);

  let kid = value === null ? key : getActualKey(key, value);
  kid = id.getID(kid);

  const nid = hash(kid, Object.keys(nodes));
  const node = nodes[nid];

  return await distribution.local.async.comm.send(message, {
    node,
    service,
    method,
  });
}

async function sendToAll({ message, service, method, gid, exclude, subset }) {
  let nodes = await distribution.local.async.groups.get(gid);
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
  const settled = await Promise.allSettled(
    nodes.map(
      async (node) =>
        await distribution.local.async.comm.send(message, {
          node,
          service,
          method,
        })
    )
  );
  for (let i = 0; i < nodes.length; i++) {
    const sid = id.getSID(nodes[i]);
    const { status, value, reason } = settled[i];
    if (status === "fulfilled" && value !== null) {
      sidToValue[sid] = value;
    }
    if (status === "rejected" && reason != null) {
      sidToError[sid] = reason;
    }
  }
  return [sidToError, sidToValue];
}

async function getPageContents(url) {
  url = new URL(url);
  let body = [];
  await new Promise((resolve, reject) => {
    https
      .request(url, (res) => {
        res.on("data", (chunk) => body.push(chunk));
        res.on("end", resolve);
      })
      .on("error", reject)
      .end();
  });
  return Buffer.concat(body).toString();
}

function getUrls(url, body) {
  const ret = [];
  const dom = new JSDOM(body);
  for (let link of dom.window.document.querySelectorAll("a[href]")) {
    link = link.getAttribute("href");
    try {
      link = new URL(link, url);
    } catch (e) {
      console.trace("failed to build url from", e, link, url);
      continue;
    }
    link = link.href;
    ret.push(link);
  }
  return ret;
}

function asyncRPC(func) {
  const installation = distribution.local.async.rpc.install(func);
  return eval(`(...args) => {
    const callback = args.pop() || function() {};
    let message = [args, ${JSON.stringify(installation)}];
    const node = ${JSON.stringify(global.nodeConfig)};
    const service = 'rpc';
    const method = 'call';
    global.distribution.local.async.comm.send(message, {node, service, method})
      .then(v => callback(null, v))
      .catch(e => callback(e, null));
  }`);
}

function createRPC(func) {
  return asyncRPC(promisify(func));
}

function toAsync(func) {
  return function (...args) {
    const callback = args.pop() || function () {};
    try {
      const result = func(...args);
      callback(null, result);
    } catch (error) {
      callback(error, null);
    }
  };
}

module.exports = {
  serialize: serialization.serialize,
  deserialize: serialization.deserialize,
  sendToAll,
  getActualKey,
  whichHashTo,
  callOnHolder,
  getPageContents,
  getUrls,
  id,
  wire: { createRPC, asyncRPC, toAsync },
};
