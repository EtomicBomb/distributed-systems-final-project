global.nodeConfig = {ip: '127.0.0.1', port: 8080};
const distribution = require('../distribution');
const id = distribution.util.id;
const process = require('node:process');

const groupsTemplate = require('../distribution/all/groups');

// This group is used for testing most of the functionality
const mygroupGroup = {};

const n1 = {ip: '127.0.0.1', port: 8000};
const n2 = {ip: '127.0.0.1', port: 8001};
const n3 = {ip: '127.0.0.1', port: 8002};

mygroupGroup[id.getSID(n1)] = n1;
mygroupGroup[id.getSID(n2)] = n2;
mygroupGroup[id.getSID(n3)] = n3;

function doAll(count, forward, callback) {
  count -= 1;
  console.log('a', count);
  if (count <= 0) {
    callback();
  } else {
    forward(count, () => doAll(count, forward, callback));
  }
}

distribution.node.start((server) => {
  localServer = server;
  distribution.local.status.spawn(n1, (e, v) => {
    distribution.local.status.spawn(n2, (e, v) => {
      distribution.local.status.spawn(n3, (e, v) => {
        const mygroupConfig = {gid: 'mygroup'};
        // Create some groups
        groupsTemplate(mygroupConfig)
            .put(mygroupConfig, mygroupGroup, (e, v) => {
              const user = {first: 'Josiah', last: 'Carberry'};
              const keys = new Array(1000)
                  .fill(0)
                  .map(() => (Math.random() * 1000).toString());
              doAll(
                  400,
                  (i, cb) => distribution.all.store.put(user, keys[i], cb),
                  () => {
                    doAll(
                        400,
                        (i, cb) => distribution.all.store.get(keys[i], cb),
                        () => {
                          console.trace('done');
                          process.exit(0);
                        },
                    );
                  },
              );
            });
      });
    });
  });
});
