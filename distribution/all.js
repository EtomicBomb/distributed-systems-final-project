// const serialization = require('./serialization');
// const local = require('./local');

const routes = {};

const Comm = {
  send() {
  },
};

const Groups = {
  get() {
  },
  put() {
  },
  add() {
  },
  rem() {
  },
  del() {
  },
};

const Routes = {
  put() {
  },
};

const Status = {
  get() {
  },
  stop() {
  },
  spawn() {
  },
};

const Gossip = {
  send() {
  },
  at() {
  },
  del() {
  },
};

routes.comm = Comm;
routes.groups = Groups;
routes.routes = Routes;
routes.status = Status;
routes.gossip = Gossip;

module.exports = routes;
