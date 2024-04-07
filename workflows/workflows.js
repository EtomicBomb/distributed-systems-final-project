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
    await distribution.local.async.status.spawn(node);
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

  let result;
  let mapper;
  let reducer;
  let keys;

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
      const bareUrl = contentUrl.split(' ')[1];
      const urls = distribution.util.getUrls(bareUrl, body);
      return urls.map(url => ({[bareUrl]: url}));
  };
  `);
  reducer = eval(`
  async (bareUrl, urlsInSource) => {
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
      const bareUrl = urlsUrl.split(' ')[1];
      return urls.map(url => ({[url]: bareUrl}));
  };
  `);
  reducer = eval(`
  async (url, bareUrls) => {
      return {[url]: [...new Set(bareUrls)]};
  };
  `);
  result = await promisify((cb) => {
    require('../distribution/all/mr')(gidConfig)
        .exec({keys, map: mapper, reduce: reducer}, cb);
  })();

  for (const node of nodes) {
    await distribution.local.async.comm.send([], {service: 'status', method: 'stop', node});
  }
  await promisify((cb) => server.close(cb))();
  return result;
}

crawler('crawl', console.log).then(console.log).catch((c) => console.error('error2', c));

