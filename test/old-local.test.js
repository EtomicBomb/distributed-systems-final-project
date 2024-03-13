let distribution;
let local;

let routes;
let comm;
let status;

let id;
let node;

let lastPort = 8090;

beforeEach(() => {
  jest.resetModules();

  global.nodeConfig = {
    ip: '127.0.0.1',
    port: lastPort++, // Avoid port conflicts
  };

  distribution = require('../distribution');
  local = distribution.local;

  id = distribution.util.id;
  wire = distribution.util.wire;

  node = global.nodeConfig;

  routes = local.routes;
  comm = local.comm;
  status = local.status;
});

// ---STATUS---

test('(2 pts) local.status.get(sid)', (done) => {
  local.status.get('sid', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(id.getSID(node));
    done();
  });
});

test('(2 pts) local.status.get(ip)', (done) => {
  local.status.get('ip', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(node.ip);
    done();
  });
});

test('(2 pts) local.status.get(port)', (done) => {
  local.status.get('port', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(node.port);
    done();
  });
});

test('(2 pts) local.status.get(counts)', (done) => {
  local.status.get('counts', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBeDefined();
    done();
  });
});

test('(2 pts) local.status.get(random)', (done) => {
  local.status.get('random', (e, v) => {
    expect(e).toBeDefined();
    expect(e).toBeInstanceOf(Error);
    expect(v).toBeFalsy();
    done();
  });
});

// ---ROUTES---

test('(4 pts) local.routes.get(status)', (done) => {
  local.routes.get('status', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(status);
    done();
  });
});

test('(4 pts) local.routes.get(routes)', (done) => {
  local.routes.get('routes', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(routes);
    done();
  });
});

test('(4 pts) local.routes.get(comm)', (done) => {
  local.routes.get('comm', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(comm);
    done();
  });
});

test('(4 pts) local.routes.get(random)', (done) => {
  local.routes.get('random', (e, v) => {
    expect(e).toBeDefined();
    expect(e).toBeInstanceOf(Error);
    expect(v).toBeFalsy();
    done();
  });
});

test('(8 pts) local.routes.put/get(echo)', (done) => {
  const echoService = {};

  echoService.echo = () => {
    return 'echo!';
  };

  local.routes.put(echoService, 'echo', (e, v) => {
    local.routes.get('echo', (e, v) => {
      expect(e).toBeFalsy();
      expect(v.echo()).toBe('echo!');
      done();
    });
  });
});

// ---COMM---

test('(10 pts) local.comm(status.get(nid))', (done) => {
  remote = {node: node, service: 'status', method: 'get'};
  message = [
    'nid', // configuration
  ];

  distribution.node.start((server) => {
    local.comm.send(message, remote, (e, v) => {
      server.close();
      expect(e).toBeFalsy();
      expect(v).toBe(id.getNID(node));
      done();
    });
  });
});

test('(9 pts) RPC1', (done) => {
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
    local.routes.put(rpcService, 'rpcService', (e, v) => {
      local.routes.get('rpcService', (e, s) => {
        expect(e).toBeFalsy();
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

// // ---LOCAL.GROUPS---

test('(2 pts) local.groups.get(random)', (done) => {
  distribution.local.groups.get('random', (e, v) => {
    expect(e).toBeDefined();
    expect(e).toBeInstanceOf(Error);
    expect(v).toBeFalsy();
    done();
  });
});

test('(2 pts) local.groups.del(random)', (done) => {
  distribution.local.groups.del('random', (e, v) => {
    expect(e).toBeDefined();
    expect(e).toBeInstanceOf(Error);
    expect(v).toBeFalsy();
    done();
  });
});

test('(2 pts) local.groups.put(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('browncs', g, (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(g);
    done();
  });
});

test('(2 pts) local.groups.put/get(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('browncs', g, (e, v) => {
    distribution.local.groups.get('browncs', (e, v) => {
      expect(e).toBeFalsy();
      expect(v).toBe(g);
      done();
    });
  });
});

test('(2 pts) local.groups.put/get/del(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('browncs', g, (e, v) => {
    distribution.local.groups.get('browncs', (e, v) => {
      distribution.local.groups.del('browncs', (e, v) => {
        expect(e).toBeFalsy();
        expect(v).toBe(g);
        done();
      });
    });
  });
});

test('(2 pts) local.groups.put/get/del/get(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('browncs', g, (e, v) => {
    distribution.local.groups.get('browncs', (e, v) => {
      distribution.local.groups.del('browncs', (e, v) => {
        distribution.local.groups.get('browncs', (e, v) => {
          expect(e).toBeDefined();
          expect(e).toBeInstanceOf(Error);
          expect(v).toBeFalsy();
          done();
        });
      });
    });
  });
});

test('(2 pts) local.groups.put(dummy)/add(n1)/get(dummy)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('dummy', g, (e, v) => {
    const n1 = {ip: '127.0.0.1', port: 8082};

    distribution.local.groups.add('dummy', n1, (e, v) => {
      const expectedGroup = {
        ...g, ...{[id.getSID(n1)]: n1},
      };

      distribution.local.groups.get('dummy', (e, v) => {
        expect(e).toBeFalsy();
        expect(v).toEqual(expectedGroup);
        done();
      });
    });
  });
});

test('(2 pts) local.groups.put(dummy)/rem(n1)/get(dummy)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('dummy', g, (e, v) => {
    distribution.local.groups.rem('dummy', '507aa', (e, v) => {
      const expectedGroup = {
        '12ab0': {ip: '127.0.0.1', port: 8081},
      };

      distribution.local.groups.get('dummy', (e, v) => {
        expect(e).toBeFalsy();
        expect(v).toEqual(expectedGroup);
        done();
      });
    });
  });
});
