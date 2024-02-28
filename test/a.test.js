global.nodeConfig = {ip: '127.0.0.1', port: 8080};
const distribution = require('../distribution');
const id = distribution.util.id;

const groupsTemplate = require('../distribution/all/groups');
const mygroupGroup = {};
// let localServer = null;

beforeAll((done) => {
  const n1 = {ip: '127.0.0.1', port: 8000};
  const n2 = {ip: '127.0.0.1', port: 8001};
  const n3 = {ip: '127.0.0.1', port: 8002};

  // First, stop the nodes if they are running
  let remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
      });
    });
  });

  mygroupGroup[id.getSID(n1)] = n1;
  mygroupGroup[id.getSID(n2)] = n2;
  mygroupGroup[id.getSID(n3)] = n3;

  // Now, start the base listening node
  distribution.node.start((server) => {
    localServer = server;
    // Now, start the nodes
    distribution.local.status.spawn(n1, (e, v) => {
      distribution.local.status.spawn(n2, (e, v) => {
        distribution.local.status.spawn(n3, (e, v) => {
          groupsTemplate({gid: 'mygroup'})
              .put('mygroup', mygroupGroup, (e, v) => {
                done();
              });
        });
      });
    });
  });
});

test('(4 pts) all.comm.send(status.get(nid))', (done) => {
  const nids = Object.values(mygroupGroup).map((node) => id.getNID(node));
  const remote = {service: 'status', method: 'get'};

  distribution.mygroup.comm.send(['nid'], remote, (e, v) => {
      console.trace(e, v);
    expect(e).toEqual({});
    expect(Object.values(v).length).toBe(nids.length);
    expect(Object.values(v)).toEqual(expect.arrayContaining(nids));
    done();
  });
});
test('(4 pts) all.comm.send(status.get(nid))', (done) => {
  const nids = Object.values(mygroupGroup).map((node) => id.getNID(node));
  const remote = {service: 'status', method: 'get'};

  distribution.mygroup.comm.send(['nid'], remote, (e, v) => {
      console.trace(e, v);
    expect(e).toEqual({});
    expect(Object.values(v).length).toBe(nids.length);
    expect(Object.values(v)).toEqual(expect.arrayContaining(nids));
    done();
  });
});

test('(2 pts) all.comm.send(status.get(random))', (done) => {
  const remote = {service: 'status', method: 'get'};

  distribution.mygroup.comm.send(['random'], remote, (e, v) => {
    Object.keys(mygroupGroup).forEach((sid) => {
      expect(e[sid]).toBeDefined();
      expect(e[sid]).toBeInstanceOf(Error);
    });
    expect(v).toEqual({});
    done();
  });
});

test('(2 pts) all.groups.del(random)', (done) => {
  distribution.mygroup.groups.del('random', (e, v) => {
    Object.keys(mygroupGroup).forEach((sid) => {
      expect(e[sid]).toBeDefined();
      expect(e[sid]).toBeInstanceOf(Error);
    });
    expect(v).toEqual({});
    done();
  });
});

test('(2 pts) all.groups.put(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.mygroup.groups.put('browncs', g, (e, v) => {
    expect(e).toEqual({});
    Object.keys(mygroupGroup).forEach((sid) => {
      expect(v[sid]).toEqual(g);
    });
    done();
  });
});

test('(2 pts) all.groups.put/get(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.mygroup.groups.put('browncs', g, (e, v) => {
      console.trace('x', e, v);
    distribution.mygroup.groups.get('browncs', (e, v) => {
      console.trace('y', e, v);
      expect(e).toEqual({});
      Object.keys(mygroupGroup).forEach((sid) => {
        expect(v[sid]).toEqual(g);
      });
      done();
    });
  });
});

test('(2 pts) all.groups.put/get/del(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.mygroup.groups.put('browncs', g, (e, v) => {
    distribution.mygroup.groups.get('browncs', (e, v) => {
      distribution.mygroup.groups.del('browncs', (e, v) => {
        expect(e).toEqual({});
        Object.keys(mygroupGroup).forEach((sid) => {
          expect(v[sid]).toEqual(g);
        });
        done();
      });
    });
  });
});

test('(2 pts) all.groups.put/get/del/get(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.mygroup.groups.put('browncs', g, (e, v) => {
    distribution.mygroup.groups.get('browncs', (e, v) => {
      distribution.mygroup.groups.del('browncs', (e, v) => {
        distribution.mygroup.groups.get('browncs', (e, v) => {
            console.trace('our test', e, v);
          expect(e).toBeDefined();
          Object.keys(mygroupGroup).forEach((sid) => {
            expect(e[sid]).toBeInstanceOf(Error);
          });
          expect(v).toEqual({});
          done();
        });
      });
    });
  });
});

test('(2 pts) all.groups.put(dummy)/add(n1)/get(dummy)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.mygroup.groups.put('dummy', g, (e, v) => {
    let n1 = {ip: '127.0.0.1', port: 8082};

    distribution.mygroup.groups.add('dummy', n1, (e, v) => {
      let expectedGroup = {
        ...g, ...{[id.getSID(n1)]: n1},
      };

      distribution.mygroup.groups.get('dummy', (e, v) => {
        expect(e).toEqual({});
        Object.keys(mygroupGroup).forEach((sid) => {
          expect(v[sid]).toEqual(expectedGroup);
        });
        done();
      });
    });
  });
});


test('(2 pts) all.groups.put(dummy)/rem(n1)/get(dummy)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.mygroup.groups.put('browncs', g, (e, v) => {
    distribution.mygroup.groups.rem('browncs', '507aa', (e, v) => {
      let expectedGroup = {
        '12ab0': {ip: '127.0.0.1', port: 8081},
      };

      distribution.mygroup.groups.get('browncs', (e, v) => {
        expect(e).toEqual({});
        Object.keys(mygroupGroup).forEach((sid) => {
          expect(v[sid]).toEqual(expectedGroup);
        });
        done();
      });
    });
  });
});


test('(2 pts) all.routes.put(echo)', (done) => {
  const echoService = {};

  echoService.echo = () => {
    return 'echo!';
  };

  distribution.mygroup.routes.put(echoService, 'echo', (e, v) => {
    const n1 = {ip: '127.0.0.1', port: 8000};
    const n2 = {ip: '127.0.0.1', port: 8001};
    const n3 ={ip: '127.0.0.1', port: 8002};
    const r1 = {node: n1, service: 'routes', method: 'get'};
    const r2 = {node: n2, service: 'routes', method: 'get'};
    const r3 = {node: n3, service: 'routes', method: 'get'};

    distribution.local.comm.send(['echo'], r1, (e, v) => {
      expect(e).toBeFalsy();
      expect(v.echo()).toBe('echo!');
      distribution.local.comm.send(['echo'], r2, (e, v) => {
        expect(e).toBeFalsy();
        expect(v.echo()).toBe('echo!');
        distribution.local.comm.send(['echo'], r3, (e, v) => {
          expect(e).toBeFalsy();
          expect(v.echo()).toBe('echo!');
          done();
        });
      });
    });
  });
});

test('(2 pts) all.status.get(nid)', (done) => {
  const nids = Object.values(mygroupGroup).map((node) => id.getNID(node));

  distribution.mygroup.status.get('nid', (e, v) => {
      console.trace('our test', e, v);
    expect(e).toEqual({});
    expect(Object.values(v).length).toBe(nids.length);
    expect(Object.values(v)).toEqual(expect.arrayContaining(nids));
    done();
  });
});

test('(2 pts) all.status.get(random)', (done) => {
  distribution.mygroup.status.get('random', (e, v) => {
    Object.keys(mygroupGroup).forEach((sid) => {
      expect(e[sid]).toBeDefined();
      expect(e[sid]).toBeInstanceOf(Error);
    });
    expect(v).toEqual({});
    done();
  });
});
test('(2 pts) all.status.spawn/stop()', (done) => {
  // Spawn a node
  const nodeToSpawn = {ip: '127.0.0.1', port: 8008};

  // Spawn the node
  distribution.mygroup.status.spawn(nodeToSpawn, (e, v) => {
    expect(e).toBeFalsy();
    expect(v.ip).toEqual(nodeToSpawn.ip);
    expect(v.port).toEqual(nodeToSpawn.port);

    remote = {node: nodeToSpawn, service: 'status', method: 'get'};
    message = [
      'nid', // configuration
    ];

    // Ping the node, it should respond
    distribution.local.comm.send(message, remote, (e, v) => {
      expect(e).toBeFalsy();
      expect(v).toBe(id.getNID(nodeToSpawn));

      distribution.local.groups.get('mygroup', (e, v) => {
        expect(e).toBeFalsy();
        expect(v[id.getSID(nodeToSpawn)]).toBeDefined();

        remote = {node: nodeToSpawn, service: 'status', method: 'stop'};

        // Stop the node
        distribution.local.comm.send([], remote, (e, v) => {
          expect(e).toBeFalsy();
          expect(v.ip).toEqual(nodeToSpawn.ip);
          expect(v.port).toEqual(nodeToSpawn.port);

          remote = {node: nodeToSpawn, service: 'status', method: 'get'};

          // Ping the node again, it shouldn't respond
          distribution.local.comm.send(message,
              remote, (e, v) => {
                console.trace('test result', e, v);
                expect(e).toBeDefined();
                expect(e).toBeInstanceOf(Error);
                expect(v).toBeFalsy();
                done();
              });
        });
      });
    });
  });
});

test('(6 pts) all.gossip.send()', (done) => {
  distribution.mygroup.groups.put('newgroup', {}, (e, v) => {
    let newNode = {ip: '127.0.0.1', port: 4444};
    let message = [
      'newgroup',
      newNode,
    ];
      

    let remote = {service: 'groups', method: 'add'};
    distribution.mygroup.gossip.send(message, remote, (e, v) => {
      distribution.mygroup.groups.get('newgroup', (e, v) => {
        let count = 0;
        for (const k in v) {
          if (Object.keys(v[k]).length > 0) {
            count++;
          }
        }
        /* Gossip only provides weak guarantees */
        expect(count).toBeGreaterThanOrEqual(2);
        done();
      });
    });
  });
});
