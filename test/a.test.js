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

/*
test('(2 pts) all.groups.put/get(browncs)', (done) => {
  let g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

    distribution.mygroup.groups.get('mygroup', (e, v) => {
        console.trace(e, v);
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
*/
