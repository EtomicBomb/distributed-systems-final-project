const args = require('yargs').argv;

// Default configuration
const config = {
  ip: '127.0.0.1',
  port: 8080,
};

/*
    Configuration can be overriden when calling distribution.js
    with the --config flag
*/
if (args.config) {
  let newConfig = JSON.parse(args.config);
  config.ip = newConfig.ip;
  config.port = parseInt(newConfig.port);
}

module.exports = config;
