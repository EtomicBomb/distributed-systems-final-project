#!/usr/bin/env node

const util = require('./distribution/util.js');
const args = require('yargs').argv;

// Default configuration
global.nodeConfig = global.nodeConfig || {
  ip: '127.0.0.1',
  port: 8080,
  onStart: () => {
    console.log('Node started!');
  },
};

/*
    As a debugging tool, you can pass ip and port arguments directly.
    This is just to allow for you to easily startup nodes from the terminal.

    Usage:
    ./distribution.js --ip '127.0.0.1' --port 1234
  */
if (args.ip) {
  global.nodeConfig.ip = args.ip;
}

if (args.port) {
  global.nodeConfig.port = parseInt(args.port);
}

if (args.config) {
  let nodeConfig = util.deserialize(args.config);
  global.nodeConfig.ip = nodeConfig.ip ? nodeConfig.ip : global.nodeConfig.ip;
  global.nodeConfig.port = nodeConfig.port ?
        nodeConfig.port : global.nodeConfig.port;
  global.nodeConfig.onStart = nodeConfig.onStart ?
        nodeConfig.onStart : global.nodeConfig.onStart;
}

const distribution = {
  util: require('./distribution/util'),
  local: require('./distribution/local'),
  node: require('./distribution/node'),
  all: require('./distribution/all'),
};

global.distribution = distribution;

module.exports = distribution;

/* The following code is run when distribution.js is run directly */
if (require.main === module) {
  distribution.node.start(global.nodeConfig.onStart);
}
