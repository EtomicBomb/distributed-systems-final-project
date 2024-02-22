const serialization = require('../util/serialization');
const local = require('../local/local.js');

function createRPC(func) {
  const installation = local.rpc.install(func);
  let stub;
  stub = (...args) => {
    const callback = args.pop() || function() {};
    let message = [args, '__INSTALLATION_ID__'];
    let remote = {
      node: {port: '__NODE_PORT__', ip: '__NODE_IP__'},
      service: 'rpc',
      method: 'call',
    };
    local.comm.send(message, remote, callback);
  };
  stub = serialization.serialize(stub)
      .replace(`__NODE_IP__`, global.config.ip)
      .replace(`'__NODE_PORT__'`, global.config.port)
      .replace(`'__INSTALLATION_ID__'`, installation);
  return serialization.deserialize(stub, (expr) => eval(expr));
}

/*
    The toAsync function converts a synchronous function that returns a value
    to one that takes a callback as its last argument and returns the value
    to the callback.
*/
function toAsync(func) {
  return function(...args) {
    const callback = args.pop() || function() {};
    try {
      const result = func(...args);
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  };
}

module.exports = {
  createRPC: createRPC,
  toAsync: toAsync,
};
