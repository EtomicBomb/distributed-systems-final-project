const MemStore = require('./memStore');

module.exports = (...args) => new MemStore('mem', ...args);
