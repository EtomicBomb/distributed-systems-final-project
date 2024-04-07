const {promisify} = require('node:util');

global.nodeConfig = {ip: '127.0.0.1', port: 7070};
const {createGroup} = require('../distribution/all');
global.distribution = require('../distribution');

async function crawler(gid) {
  const nodes = [
    {ip: '127.0.0.1', port: 7110},
    {ip: '127.0.0.1', port: 7111},
    {ip: '127.0.0.1', port: 7112},
    {ip: '127.0.0.1', port: 7113},
  ];
  let group = nodes.map((node) => [distribution.util.id.getSID(node), node]);
  group = Object.fromEntries(group);
  let gidConfig = {gid};

//console.trace('running');
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
    await distribution.local.async.status.spawn(node);
  }

  await createGroup(gidConfig, group);

  const dummyKeys = [];
  let index = 0;
  for (const url of urls) {
    const dummyKey = `${index}`;
    dummyKeys.push(dummyKey);
    await distribution[gid].async.store.put(url, dummyKey);
    index += 1;
  }

  let result;
  let mapper;
  let reducer;
  let keys;

  keys = dummyKeys;
  mapper = eval(`async (dummy, url) => {
      let body = await distribution.util.getPageContents(url);
      const {gid} = ${JSON.stringify(gidConfig)};
      await distribution[gid].async.store.put(body, {key: 'content '+url, gid});
      return [];
  }`);
  reducer = (key, values) => ({[key]: values});
  result = await distribution[gid].async.mr.exec({keys, map: mapper, reduce: reducer});


  keys = urls.map((url) => 'content '+url);
  mapper = async (contentUrl, body) => {
    const bareUrl = contentUrl.split(' ')[1];
    const urls = distribution.util.getUrls(bareUrl, body);
    return urls.map((url) => ({[bareUrl]: url}));
  };
  reducer = eval(`async (bareUrl, urlsInSource) => {
      const {gid} = ${JSON.stringify(gidConfig)};
      await distribution[gid].async.store.put(urlsInSource, {key: 'urls '+bareUrl, gid});
      return {[bareUrl]: null};
  }`);
  result = await distribution[gid].async.mr.exec({keys, map: mapper, reduce: reducer});

  keys = urls.map((url) => 'urls '+url);
  mapper = async (urlsUrl, urls) => {
    const bareUrl = urlsUrl.split(' ')[1];
    return urls.map((url) => ({[url]: bareUrl}));
  };
  reducer = async (url, bareUrls) => {
    return {[url]: [...new Set(bareUrls)]};
  };
  result = await distribution[gid].async.mr.exec({keys, map: mapper, reduce: reducer});
    console.trace(result);

  for (const node of nodes) {
    await distribution.local.async.comm.send([], {service: 'status', method: 'stop', node});
  }
  await promisify((cb) => server.close(cb))();
  return result;
}

crawler('crawl').then((v) => console.log);

