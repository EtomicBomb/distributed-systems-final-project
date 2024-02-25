let distribution;
let local;

let routes;
let comm;
let status;

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

  wire = distribution.util.wire;

  node = global.config;
});

test('existing', (done) => {
  status.get('counts', (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBeDefined();
    const count = v;
    status.get('counts', (e, v) => {
      expect(v >= count).toBeTruthy();
      done();
    });
  });
});

test('a status not there', (done) => {
  status.get('could not be found', (e, v) => {
    expect(e).toBeInstanceOf(Error);
    expect(v).toBeFalsy();
    done();
  });
});

test('(5 pts) routes: put() -> get()', (done) => {
  const echoService = {};

  echoService.echo = () => {
    return 'serviceThere';
  };

  routes.put(echoService, 'echo', (e, v) => {
    routes.get('echo', (e, v) => {
      expect(e).toBeFalsy();
      expect(v.echo()).toBe('serviceThere');
      done();
    });
  });
});

test('remote call status', (done) => {
  remote = {node: node, service: 'status', method: 'get'};
  message = [
    'ip',
  ];

  distribution.node.start((server) => {
    comm.send(message, remote, (e, v) => {
      server.close();
      expect(e).toBeFalsy();
      expect(v).toBe(node.ip);
      done();
    });
  });
});

test('(5 pts) RPC', (done) => {
  let echo = () => {
    return 'echo';
  };

  echo = distribution.util.wire.createRPC(
      distribution.util.wire.toAsync(echo));

  const rpcService = {
    echo: echo,
  };

  distribution.node.start((server) => {
    routes.put(rpcService, 'rpcService', (e, v) => {
      routes.get('rpcService', (e, s) => {
        s.echo((e, v) => {
          server.close();
          expect(e).toBeFalsy();
          expect(v).toBe('echo');
          done();
        });
      });
    });
  });
});
