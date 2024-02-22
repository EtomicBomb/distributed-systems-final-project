let distribution;
let local;

let routes;
let comm;
let status;

let id;
let node;

let lastPort = 8080;

beforeEach(() => {
  jest.resetModules();

  global.config = {
    ip: '127.0.0.1',
    port: lastPort++, // Avoid port conflicts
  };

  distribution = require('../distribution');
  local = distribution.local;

  status = local.status;
  routes = local.routes;
  comm = local.comm;

  id = distribution.util.id;
  wire = distribution.util.wire;

  node = global.config;
});

// ---STATUS---

test('(1 pt) status: get(sid)', (done) => {
  status.get('sid', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(id.getSID(node));
    done();
  });
});

test('(1 pt) status: get(ip)', (done) => {
  status.get('ip', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(node.ip);
    done();
  });
});

test('(1 pt) status: get(port)', (done) => {
  status.get('port', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(node.port);
    done();
  });
});

test('(1 pt) status: get(counts)', (done) => {
  status.get('counts', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBeDefined();
    done();
  });
});

test('(1 pt) status: get(random)', (done) => {
  status.get('random', (e, v) => {
    expect(e).toBeDefined();
    expect(e).toBeInstanceOf(Error);
    expect(v).toBeFalsy();
    done();
  });
});

// ---ROUTES---

test('(1 pt) routes.get(status)', (done) => {
  routes.get('status', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(status);
    done();
  });
});


test('(1 pt) routes.get(routes)', (done) => {
  routes.get('routes', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(routes);
    done();
  });
});

test('(1 pt) routes.get(comm)', (done) => {
  routes.get('comm', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(comm);
    done();
  });
});

test('(1 pt) routes.get(random)', (done) => {
  routes.get('random', (e, v) => {
    expect(e).toBeDefined();
    expect(e).toBeInstanceOf(Error);
    expect(v).toBeFalsy();
    done();
  });
});

test('(5 pts) routes: put() -> get()', (done) => {
  const echoService = {};

  echoService.echo = () => {
    return 'echo!';
  };

  routes.put(echoService, 'echo', (e, v) => {
    routes.get('echo', (e, v) => {
      expect(e).toBeFalsy();
      expect(v.echo()).toBe('echo!');
      done();
    });
  });
});

// ---COMM---

test('(5 pts) comm: status.get()', (done) => {
  remote = {node: node, service: 'status', method: 'get'};
  message = [
    'nid', // configuration
  ];

  distribution.node.start((server) => {
    comm.send(message, remote, (e, v) => {
      server.close();
      expect(e).toBeFalsy();
      expect(v).toBe(id.getNID(node));
      done();
    });
  });
});

test('(5 pts) RPC', (done) => {
  let n = 0;

  const addOne = () => {
    return ++n;
  };

  const addOneRPC = distribution.util.wire.createRPC(
      distribution.util.wire.toAsync(addOne));

  const rpcService = {
    addOneRPC: addOneRPC,
  };

  distribution.node.start((server) => {
    routes.put(rpcService, 'rpcService', (e, v) => {
      routes.get('rpcService', (e, s) => {
        expect(e).toBeFalsy();
        console.trace('tracing service', s.addOneRPC);
        s.addOneRPC((e, v) => {
          s.addOneRPC((e, v) => {
            s.addOneRPC((e, v) => {
              server.close();
              expect(e).toBeFalsy();
              expect(v).toBe(3);
              done();
            });
          });
        });
      });
    });
  });
});
