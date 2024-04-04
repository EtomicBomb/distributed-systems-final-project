const https = require('node:https');
const {promisify} = require('node:util');
const {JSDOM} = require('jsdom');
const serialization = require('./serialization');
const id = require('./id');
const wire = require('./wire');

function getActualKey(key, value) {
  return key === null ? id.getID(value) : key;
}

async function callOnHolder(
    {key, value, gid, hash, message, service, method},
) {
  let nodes = await promisify((cb) => distribution.local.groups.get(gid, cb))();

  nodes = Object.values(nodes);
  nodes = nodes.map((node) => [id.getNID(node), node]);
  nodes = Object.fromEntries(nodes);

  let kid = value === null ? key : getActualKey(key, value);
  kid = id.getID(kid);

  const nid = hash(kid, Object.keys(nodes));
  const node = nodes[nid];

  return await promisify((cb) => {
    distribution.local.comm.send(
        message,
        {node, service, method},
        cb,
    );
  })();
}

function defaultGIDConfig(gidConfig) {
  gidConfig = gidConfig || {};
  gidConfig.gid = gidConfig.gid || 'all';
  gidConfig.subset = gidConfig.subset || ((lst) => 3);
  gidConfig.hash = gidConfig.hash || id.naiveHash;
  gidConfig.memOrStore = 'store';
  return gidConfig;
}

async function sendToAll({message, service, method, callback, gid, exclude, subset}) {
  let nodes = await promisify((cb) => distribution.local.groups.get(gid, cb))();
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
  for (const node of nodes) {
    const sid = id.getSID(node);
    const [e, v] = await new Promise((cb) =>
      distribution.local.comm.send(
          message, {node, service, method}, (e, v) => cb([e, v]),
      ),
    );
    if (e !== null) {
      sidToError[sid] = e;
    }
    if (v !== null) {
      sidToValue[sid] = v;
    }
  }
  return [sidToError, sidToValue];
}

async function getPageContents(url) {
  url = new URL(url);
  return await new Promise((resolve, reject) => {
    https.request(url, (res) => {
      let body = [];
      res
          .on('data', (chunk) => {
            body.push(chunk);
          })
          .on('end', () => {
            body = Buffer.concat(body).toString();
            resolve({body, status: res.statusCode});
          });
    })
        .on('error', (e) => {
          reject(e);
        })
        .end();
  });
}

function getUrls(url, body) {
  const ret = [];
  const dom = new JSDOM(body);
  for (let link of dom.window.document.querySelectorAll('a[href]')) {
    link = link.getAttribute('href');
    try {
      link = new URL(link, url);
    } catch (e) {
      console.trace('failed to build url from', e, link, url);
      continue;
    }
    link = link.href;
    ret.push(link);
  }
  return ret;
}

module.exports = {
  serialize: serialization.serialize,
  deserialize: serialization.deserialize,
  defaultGIDConfig,
  sendToAll,
  getActualKey,
  callOnHolder,
  getPageContents,
  getUrls,
  id,
  wire,
};
