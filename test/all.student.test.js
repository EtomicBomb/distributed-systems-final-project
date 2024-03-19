
let distribution;


beforeEach(() => {
  jest.resetModules();

  global.nodeConfig = {
    ip: '127.0.0.1',
    port: lastPort++, // Avoid port conflicts
  };

  distribution = require('../distribution');

  wire = distribution.util.wire;
});

let lastPort = 8090;
test('(0 pts) store weird objects store', (done) => {
  const user = ['this \n is \n a \n'];
  user.push(user);
  const key = 'object/name/with/slashes\n';

  distribution.local.store.put(user, key, (e, v) => {
    distribution.local.store.del(key, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(user);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});
test('(0 pts) weird objects mem', (done) => {
  const user = ['another object'];
  const key = 'whats up here';

  distribution.local.mem.put(user, key, (e, v) => {
    distribution.local.mem.get(key, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(user);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});
test('(0 pts) mem then store retrieve', (done) => {
  const user = ['this \n is \n a \n'];
  const key = 'this is my name';
  distribution.local.mem.put(user, key, (e, v) => {
    distribution.local.store.get(key, (e, v) => {
      try {
        expect(e).toBeInstanceOf(Error);
        expect(v).toBeFalsy();
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});
test('(0 pts) get object with no relevant entries shouldnt crash', (done) => {
  const key = 'nothing here';
  distribution.local.store.get(key, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});
test('(0 pts) no storage race', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmpdg';

  distribution.local.mem.put(user, key, (e, v) => {
    distribution.local.mem.get(key, (e, v) => {
      distribution.local.mem.del(key, (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v).toEqual(user);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});
