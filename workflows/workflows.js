const https = require('node:https');
const readline = require('readline');
const {JSDOM} = require('jsdom');
const {URL} = require('url');
const {convert} = require('html-to-text');

global.nodeConfig = {ip: '127.0.0.1', port: 7070};
global.distribution = require('../distribution');

function getUrls(url, body) {
  url = url.endsWith('index.html') ? url : `${url}/`;
  const ret = [];
  const dom = new JSDOM(body);
  for (let link of dom.window.document.querySelectorAll('a[href]')) {
    link = link.getAttribute('href');
    try {
      link = new URL(link, url);
    } catch (e) {
      continue;
    }
    link = link.href;
    ret.push(link);
  }
  return ret;
}

function getPageContents(url, callback) {
  try {
    url = new URL(url);
  } catch (e) {
    callback(new Error('invalid url', {source: e}), null);
    return;
  }
  let callbackCalled = false;

  https.request(url, (res) => {
    let body = [];
    res
        .on('data', (chunk) => {
          body.push(chunk);
        })
        .on('end', () => {
          body = Buffer.concat(body).toString();
          if (callbackCalled) {
            return;
          }
          callbackCalled = true;
          callback(null, {body, status: res.statusCode});
        });
  })
      .on('error', (e) => {
        if (callbackCalled) {
          return;
        }
        callbackCalled = true;
        callback(e, null);
      })
      .end();
}

function distributePage(url, gidConfig, callback) {
  gidConfig = distribution.util.defaultGIDConfig(gidConfig);
  const {gid, memOrStore} = gidConfig;
  getPageContents(url, (e, v) => {
    const {body} = body;
    require(`./all/${memOrStore}`)(gidConfig)
        .put(body, {key: url, gid}, callback);
  });
}

function sequence(functions, args, callback) {
  if (functions.length === 0) {
    callback(null, args);
      return;
  }
    console.trace(functions, functions.length);
  functions[0]((...as) => sequence(functions.slice(1), as, callback), ...args);
}

function runWorkflow(gid, callback) {
  const nodes = [
    {ip: '127.0.0.1', port: 7110},
    {ip: '127.0.0.1', port: 7111},
    {ip: '127.0.0.1', port: 7112},
  ];
  let group = nodes.map((node) => [distribution.util.id.getSID(node), node]);
  group = Object.fromEntries(group);
  const gidConfig = {gid};

  let dataset = [
    {'b1-l1': 'It was the best of times, it was the worst of times,'},
    {'b1-l2': 'it was the age of wisdom, it was the age of foolishness,'},
    {'b1-l3': 'it was the epoch of belief, it was the epoch of incredulity,'},
    {'b1-l4': 'it was the season of Light, it was the season of Darkness,'},
    {'b1-l5': 'it was the spring of hope, it was the winter of despair,'},
  ];

  let m2 = (key, value) => {
    return value
        .split(/(\s+)/)
        .filter((e) => e !== ' ')
        .map((w) => ({[w]: 1}));
  };

  let r2 = (key, values) => {
    return {[key]: values.length};
  };

  let server;
  let result;

  sequence([
    (callback) => distribution.node.start(callback),
    (callback, s) => {
      server = s;
      callback(null, null);
    },
    ...nodes.map((node) => ((callback) => distribution.local.status.spawn(node, callback))),
    (callback) => require('../distribution/all/groups')(gidConfig).put(gidConfig, group, callback),
    ...dataset.map((data) => ((callback) => distribution[gid].store.put(Object.values(data)[0], Object.keys(data)[0], callback))),
    (callback) => distribution[gid].store.get(null, callback),
    (callback, _, keys) => distribution[gid].mr.exec({keys, map: m2, reduce: r2}, callback),
    (callback, e, v) => {
      result = v;
        console.trace(e, v);
      callback(null, null);
    },
    ...nodes.map((node) => ((callback) => distribution.local.comm.send([], {service: 'status', method: 'stop', node}, callback))),
    (callback) => server.close(callback),
  ], [], () => callback(null, result));
}

module.exports = {runWorkflow};
