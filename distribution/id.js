const assert = require('assert');
const crypto = require('crypto');

// The ID is the SHA256 hash of the JSON representation of the object
function getID(obj) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(obj));
  return hash.digest('hex');
}

// The NID is the SHA256 hash of the JSON representation of the node
function getNID(node) {
  node = {ip: node.ip, port: node.port};
  return getID(node);
}

function getSID(node) {
  return getNID(node).substring(0, 5);
}

function idToNum(id) {
  let n = parseInt(id, 16);
  assert(!isNaN(n), 'idToNum: id is not in KID form!');
  return n;
}

function naiveHash(kid, nids) {
  nids.sort();
  return nids[idToNum(kid) % nids.length];
}

function consistentHash(kid, nids) {
  kid = idToNum(kid);
  const numericalNIDs = nids.map(idToNum);
  numericalNIDs.push(kid);
  numericalNIDs.sort();
  let found = numericalNIDs.indexOf(kid);
  found = numericalNIDs[(found + 1) % numericalNIDs.length];
  return nids.find((nid) => idToNum(nid) === found);
}

function cmp(key) {
  return (a, b) => {
    a = key(a);
    b = key(b);
    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
    return 0;
  };
}

function rendezvousHash(kid, nids) {
  nids = nids
      .map((nid) => {
        const hash = crypto.createHash('sha256');
        hash.update(nid + kid);
        [nid, idToNum(hash.digest('hex'))];
      })
      .sort(cmp((a) => a[1]));
  return nids[nids.length-1][0];
}

module.exports = {
  getNID: getNID,
  getSID: getSID,
  getID: getID,
  idToNum: idToNum,
  naiveHash: naiveHash,
  consistentHash: consistentHash,
  rendezvousHash: rendezvousHash,
};
