const readline = require('readline');
const {URL} = require('url');
const {convert} = require('html-to-text');
const {promisify} = require('node:util');

global.nodeConfig = {ip: '127.0.0.1', port: 7070};
global.distribution = require('../distribution');

async function crawler(gid, callback) {
  const nodes = [
    {ip: '127.0.0.1', port: 7110},
    {ip: '127.0.0.1', port: 7111},
    {ip: '127.0.0.1', port: 7112},
    {ip: '127.0.0.1', port: 7113},
  ];
  let group = nodes.map((node) => [distribution.util.id.getSID(node), node]);
  group = Object.fromEntries(group);
  let gidConfig = {gid};

  const urls = [
    'https://en.wikipedia.org/wiki/Hualien_City',
    'https://en.wikipedia.org/wiki/Pacific_Ocean',
    'https://en.wikipedia.org/wiki/Antarctica',
    'https://en.wikipedia.org/wiki/South_Pole',
    'https://en.wikipedia.org/wiki/South_magnetic_pole',
    'https://en.wikipedia.org/wiki/Geomagnetic_pole',
    'https://en.wikipedia.org/wiki/Solar_wind',
  ];

  const server = await new Promise((cb) => distribution.node.start(cb));
  for (const node of nodes) {
    await promisify((cb) => distribution.local.status.spawn(node, cb))();
  }
  await new Promise((cb) => {
    require('../distribution/all/groups')(gidConfig)
        .put(gidConfig, group, cb);
  });

  const dummyKeys = [];
  let index = 0;
  for (const url of urls) {
    const dummyKey = `${index}`;
    dummyKeys.push(dummyKey);
    await new Promise((cb) => {
      require('../distribution/all/store')(gidConfig)
          .put(url, dummyKey, cb);
    });
    index += 1;
  }

  let result; let mapper; let reducer; let keys;

  keys = dummyKeys;
  mapper = eval(`(
    async (dummy, url) => {
      let {body} = await distribution.util.getPageContents(url);
      const {gid,memOrStore} = ${JSON.stringify(gidConfig)};
      await new Promise((res) => distribution[gid][memOrStore].put(body, {key: 'content '+url, gid}, res));
      return [];
    }
  )`);
  reducer = (key, values) => ({[key]: values});
  result = await promisify((cb) => {
    require('../distribution/all/mr')(gidConfig)
        .exec({keys, map: mapper, reduce: reducer}, cb);
  })();

  keys = urls.map((url) => 'content '+url);
  mapper = eval(`
  async (contentUrl, body) => {
      const {promisify} = require('node:util');
      const {gid,memOrStore} = ${JSON.stringify(gidConfig)};
      const bareUrl = contentUrl.split(' ')[1];
      const urls = distribution.util.getUrls(bareUrl, body);
      const ret = urls.map(url => ({[bareUrl]: url}));
      return ret;
  };
  `);
  reducer = eval(`
  async (bareUrl, urlsInSource) => {
      const {promisify} = require('node:util');
      const {gid,memOrStore} = ${JSON.stringify(gidConfig)};
      await new Promise((res) => distribution[gid][memOrStore].put(urlsInSource, {key: 'urls '+bareUrl, gid}, res));
      return {[bareUrl]: null};
  };
  `);
  result = await promisify((cb) => {
    require('../distribution/all/mr')(gidConfig)
        .exec({keys, map: mapper, reduce: reducer}, cb);
  })();

  keys = urls.map((url) => 'urls '+url);
  mapper = eval(`
  async (urlsUrl, urls) => {
      const {promisify} = require('node:util');
      const {gid,memOrStore} = ${JSON.stringify(gidConfig)};
      const bareUrl = urlsUrl.split(' ')[1];
      return urls.map(url => ({[url]: bareUrl}));
  };
  `);
  reducer = eval(`
  async (url, bareUrls) => {
      return {[url]: [...new Set(bareUrls)]};
  };
  `);
  //      const {promisify} = require('node:util');
  //      const {gid,memOrStore} = ${JSON.stringify(gidConfig)};
  //      await new Promise((res) => distribution[gid][memOrStore].put(bareUrls, {key: 'reverse '+url, gid}, res));
  result = await promisify((cb) => {
    require('../distribution/all/mr')(gidConfig)
        .exec({keys, map: mapper, reduce: reducer}, cb);
  })();

  for (const node of nodes) {
    await promisify((cb) => distribution.local.comm.send([], {service: 'status', method: 'stop', node}, cb))();
  }
  await promisify((cb) => server.close(cb))();
  return result;
}

/*

async function runWorkflow(gid, callback) {
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

  let mapper = (key, value) => {
    return value
        .split(/(\s+)/)
        .filter((e) => e !== ' ')
        .map((w) => ({[w]: 1}));
  };

  let reducer = (key, values) => {
    return {[key]: values.length};
  };

  const server = await new Promise((cb) => distribution.node.start(cb));
  for (const node of nodes) {
      await promisify(cb => distribution.local.status.spawn(node, cb))();
  }
  await new Promise((cb) => {
    require('../distribution/all/groups')(gidConfig)
        .put(gidConfig, group, cb);
  });
  for (const data of dataset) {
    await new Promise((cb) => {
      require('../distribution/all/store')(gidConfig)
          .put(Object.values(data)[0], Object.keys(data)[0], cb);
    });
  }
  const [_, keys] = await new Promise((cb) => {
    require('../distribution/all/store')(gidConfig)
        .get(null, (e, v) => cb([e, v]));
  });
  const result = await promisify((cb) => {
    require('../distribution/all/mr')(gidConfig)
        .exec({keys, map: mapper, reduce: reducer}, cb);
  })();
  for (const node of nodes) {
      await promisify((cb) => distribution.local.comm.send([], {service: 'status', method: 'stop', node}, cb))();
  }
    await promisify(cb => server.close(cb))();

  return result;
}

async function urlExtract(gid, callback) {
  const nodes = [
    {ip: '127.0.0.1', port: 7110},
    {ip: '127.0.0.1', port: 7111},
    {ip: '127.0.0.1', port: 7112},
  ];
  let group = nodes.map((node) => [distribution.util.id.getSID(node), node]);
  group = Object.fromEntries(group);
  const gidConfig = {gid};

  let dataset = [
    {'https://en.wikipedia.org/wiki/Hualien_City': null},
    {'https://en.wikipedia.org/wiki/Pacific_Ocean': null},
    {'https://en.wikipedia.org/wiki/Antarctica': null},
    {'https://en.wikipedia.org/wiki/South_Pole': null},
    {'https://en.wikipedia.org/wiki/South_magnetic_pole': null},
    {'https://en.wikipedia.org/wiki/Geomagnetic_pole': null},
    {'https://en.wikipedia.org/wiki/Solar_wind': null},
  ];

  let mapper = eval(`
    async (dummy, url) => {
      let {body} = await distribution.util.getPageContents(url);
      const {gid,memOrStore} = ${JSON.stringify(gidConfig)};
      await new Promise((res) => distribution[gid][memOrStore].put(body, {key: url, gid}, res);
      return [];
    };
  `);

  let reducer = (key, values) => {
    return {[key]: values};
  };

  const server = await new Promise((cb) => distribution.node.start(cb));
  for (const node of nodes) {
      await promisify(cb => distribution.local.status.spawn(node, cb))();
  }
  await new Promise((cb) => {
    require('../distribution/all/groups')(gidConfig)
        .put(gidConfig, group, cb);
  });
  for (const data of dataset) {
    await new Promise((cb) => {
      require('../distribution/all/store')(gidConfig)
          .put(Object.values(data)[0], Object.keys(data)[0], cb);
    });
  }
  const [_, keys] = await new Promise((cb) => {
    require('../distribution/all/store')(gidConfig)
        .get(null, (e, v) => cb([e, v]));
  });
  const result = await promisify((cb) => {
    require('../distribution/all/mr')(gidConfig)
        .exec({keys, map: mapper, reduce: reducer}, cb);
  })();
  for (const node of nodes) {
      await promisify((cb) => distribution.local.comm.send([], {service: 'status', method: 'stop', node}, cb))();
  }
  await promisify(cb => server.close(cb))();
  return result;
}

function urlExtraction(gid, callback) {
  const nodes = [
    {ip: '127.0.0.1', port: 7110},
    {ip: '127.0.0.1', port: 7111},
    {ip: '127.0.0.1', port: 7112},
  ];
  let group = nodes.map((node) => [distribution.util.id.getSID(node), node]);
  group = Object.fromEntries(group);
  const gidConfig = {gid, memOrStore: 'store'};


  let reducer = (key, values) => {
    return {[key]: values};
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
    ...dataset.map((data) => ((callback) => require('../distribution/all/store')(gidConfig).put(Object.values(data)[0], Object.keys(data)[0], callback))),
    (callback) => require('../distribution/all/store')(gidConfig).get(null, callback),
    (callback, _, keys) => require('../distribution/all/mr')(gidConfig).exec({keys, map: mapper, reduce: reducer}, callback),
    (callback, e, v) => {
      result = v;
      callback(null, null);
    },
    ...nodes.map((node) => ((callback) => distribution.local.comm.send([], {service: 'status', method: 'stop', node}, callback))),
    (callback) => server.close(callback),
  ], [], () => callback(null, result));
}

*/

// runWorkflow('hello', console.log).then(console.log).catch((c) => console.error('error2', c));
// rm -rf store/store; pkill node; clear && node workflows/workflows.js

crawler('crawl', console.log).then(console.log).catch((c) => console.error('error2', c));

