const https = require("node:https");
const { promisify } = require("node:util");
const { JSDOM } = require("jsdom");
const serialization = require("./serialization");
const id = require("./id");
const natural = require("natural");

// stemmer for created the inverted index
const porterStemmer = natural.PorterStemmer;
// stop words
const stopwords = require("./stopwords");

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
        }),
    ),
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

/* 
calculates tf-idf for all courses stored on a course node

params: 
  - courses: map of courseCode -> course details

return:
  - array, [tfidf, idf], where
    - tfidf: map, term -> idf
    - idf: map, courseCode -> map(term -> tf-idf)
*/
function tfidf(courses) {
  let tfidf = new Map(); // courseCode -> map(term -> tf)
  let idf = new Map(); // term -> idf

  // iterate over each course to create tf-idf calculates
  courses.forEach((courseCode, details) => {
    let subject = details.code.subject.toLowerCase();
    let number = details.code.number.toLowerCase();
    let title = details.title.toLowerCase();
    let description = detail.description.toLowerCase();
    let instructors = details.offerings.flatMap((offering) =>
      offering.instructors.map((ins) => ins.toLowerCase()),
    );

    // process text: merge title and description, split, stem, remove stop words
    let processedTerms = [
      ...title.split(" "),
      ...description.split(" "),
      ...instructors.split(" "),
      subject,
      number,
      courseCode.toLowerCase(),
    ];
    processedTerms = processedTerms.filter((word) => !stopwords.includes(word));
    processedTerms = processedTerms.map((word) => porterStemmer.stem(word));
    let tfAddition = 1 / processedTerms.length;

    // merge repeat words and map to frequency count and course code
    let termToFreq = processedTerms.reduce((count, word) => {
      // update tf for word
      let freqUpdate = count.get(word) || 0;
      freqUpdate += tfAddition;
      count.set(word, freqUpdate);

      // update idf mapping count
      // initialize as term -> set(course1, course2, ...)
      // to calcualte idf, take size of set as c_i, freq of term in doc
      let idfUpdate = idf.get(word) || new Set();
      idfUpdate.add(courseCode);
      idf.update(word, idfUpdate);

      return count;
    }, new Map());

    // set tf map of courseCode -> map(term -> tf)
    tfidf.set(courseCode, termToFreq);
  });

  // calcualte idf = 1 + log(N / (1 + c_i))
  // N = size of courses stored on this node
  // c_i = number of courses term_i appears in
  const N = courses.size;
  idf.forEach((value, key) => {
    let c_i = value.size;
    let idf_i = 1 + Math.log(N / (1 + c_i));
    idf.set(key, idf_i);
  });

  // calculate tf-idf,
  tfidf.forEach((terms, course) => {
    terms.forEach((tf, term) => {
      let termTfIdf = tf * idf.get(term);
      tfidf.get(course).set(term, termTfIdf);
    });
  });

  return [tfidf, idf];
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
  tfidf,
  wire: { createRPC, asyncRPC, toAsync },
};
