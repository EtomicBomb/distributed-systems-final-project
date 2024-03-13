const groupsTemplate = require('../distribution/all/groups');

const distribution = require('../distribution');
const id = require('../distribution/util').id;

const coolgroupGroup = {};

const n1 = {ip: '127.0.0.1', port: 9000};
const n2 = {ip: '127.0.0.1', port: 9001};
const n3 = {ip: '127.0.0.1', port: 9002};

let localServer = null;

beforeAll((done) => {
  coolgroupGroup[id.getSID(n1)] = n1;
  coolgroupGroup[id.getSID(n2)] = n2;
  coolgroupGroup[id.getSID(n3)] = n3;


  // First, stop the nodes if they are running
  distribution.node.start((server) => {
    localServer = server;
    let remote = {service: 'status', method: 'stop'};
    remote.node = n1;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n2;
      distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n3;
        distribution.local.comm.send([], remote, (e, v) => {
          // Now, start the nodes
          distribution.local.status.spawn(n1, (e, v) => {
            distribution.local.status.spawn(n2, (e, v) => {
              distribution.local.status.spawn(n3, (e, v) => {
                groupsTemplate({gid: 'coolgroup'})
                    .put('coolgroup', coolgroupGroup, (e, v) => {
                      done();
                    });
              });
            });
          });
        });
      });
    });
  });
});

test('coolgroup.groups.put()', (done) => {
  let g = {
    'al57j': {ip: '127.0.0.1', port: 9092},
    'q5mn9': {ip: '127.0.0.1', port: 9093},
  };

  distribution.coolgroup.groups.put('atlas', g, (e, v) => {
    expect(e).toEqual({});
    expect(v[id.getSID(n1)]).toEqual(g);
    done();
  });
});

afterAll((done) => {
  distribution.coolgroup.status.stop((e, v) => {
    localServer.close();
    done();
  });
});
