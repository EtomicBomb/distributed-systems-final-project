const serialization = require('./serialization');

function createRPC(func) {
  const installation = global.distribution.local.rpc.install(func);
  let stub;
  stub = (...args) => {
    const callback = args.pop() || function() {};
    let message = [args, `__INSTALLATION_ID__`];
    let remote = {
      node: {port: `__NODE_PORT__`, ip: `__NODE_IP__`},
      service: `rpc`,
      method: `call`,
    };
    global.distribution.local.comm.send(message, remote, callback);
  };
  stub = serialization.serialize(stub)
      .replace(`__NODE_IP__`, global.nodeConfig.ip)
      .replace('`__NODE_PORT__`', global.nodeConfig.port)
      .replace('`__INSTALLATION_ID__`', installation);
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
      callback(error, null);
    }
  };
}

module.exports = {
  createRPC: createRPC,
  toAsync: toAsync,
};