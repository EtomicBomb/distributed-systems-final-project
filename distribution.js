#!/usr/bin/env node

global.config = global.config || require('./distribution/local/config');

const distribution = {
  util: require('./distribution/util/util.js'),
  local: require('./distribution/local/local.js'),
  node: require('./distribution/local/node.js'),
};

global.distribution = distribution;
module.exports = distribution;


/* The following code is run when distribution.js is run directly */
if (require.main === module) {
  distribution.node.start(() => {
    /* Code that runs after your node has booted */
    console.log('started', global.config);
  });
}


