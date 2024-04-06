const {promisify} = require('node:util');

function createRPC(func) {
  const installation = distribution.localAsync.rpc.install(promisify(func));
  return eval(`(...args) => {
    const callback = args.pop() || function() {};
    let message = [args, ${JSON.stringify(installation)}];
    const node = ${JSON.stringify(global.nodeConfig)};
    const service = 'rpc';
    const method = 'call';
    global.distribution.localAsync.comm.send(message, {node, service, method})
      .then(v => callback(null, v))
      .catch(e => callback(e, null));
  }`);
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
      callback(error, null);
    }
  };
}

module.exports = {
  createRPC: createRPC,
  toAsync: toAsync,
};
