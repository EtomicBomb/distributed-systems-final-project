function callbackify(service, method) {
  return (...args) => {
    if (args.length === method.length + 1) {
      const callback = args.pop();
      Promise.resolve(method.call(service, ...args))
          .then((v) => callback(null, v))
          .catch((e) => callback(e, null));
    } else if (args.length === method.length) {
      console.trace(`did not provide a callback for ${method.toString()}`);
      // they did not the callback, ignore the promise
      method.call(service, ...args);
    } else {
      throw new Error(`wrong number of arguments for ${method.toString()}: found ${args.length}, expected ${method.length} ${args}`);
    }
  };
}

function serviceToCallbackService(service) {
  let ret = service;
  ret = Object.entries(ret);
  ret = ret.map(([name, method]) => [name, callbackify(service, method)]);
  ret = Object.fromEntries(ret);
  return ret;
}

let local = require('./localAsync');
local = Object.entries(local);
local = local.map(([name, service]) => [name, serviceToCallbackService(service)]);
local = Object.fromEntries(local);
module.exports = local;

