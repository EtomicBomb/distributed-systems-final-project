global.nodeConfig = { ip: "127.0.0.1", port: 7070 };
const { createGroup } = require("../distribution/all");
const distribution = require("../distribution");
const local = distribution.local.async;

test("authoritativeCourses list contains the courses", async () => {
  const list = await local.authoritativeCourses.list();
  expect(list).toContain("CSCI 1380");
  expect(list).toContain("PHP 1100");
});

test("authoritativeCourses has course detail", async () => {
  let detail = await local.authoritativeCourses.details(["CSCI 1380"]);
  detail = detail[0][1];
  expect(detail).toHaveProperty("title");
  expect(detail).toHaveProperty("description");
  expect(detail).toHaveProperty("code");
  expect(detail).toHaveProperty("prerequisites");
  expect(detail).toHaveProperty("semester_range");
  expect(detail).toHaveProperty("offerings");
});

test("authoritativeStudents basic", async () => {
  const list = await local.authoritativeStudents.list();
  const student = list[0];
  expect(student).toBeDefined();
  let detail = await local.authoritativeStudents.details([student]);
  detail = detail[0][1];
  expect(detail).toHaveProperty("name");
  expect(detail).toHaveProperty("semester");
  expect(detail).toHaveProperty("taken");
});

async function beginIndex(gidNodes, service) {
  await Promise.all(
    gidNodes.get(service).map((node) => {
      return local.comm.send([], { service, method: "beginIndex", node });
    })
  );
}

async function setup(gidCounts, job) {
  gidCounts = {
    ...gidCounts,
    authoritativeStudents: 1,
    authoritativeCourses: 1,
  };
  const ip = "127.0.0.1";
  const nodes = [];
  const gidNodes = new Map();
  let gidPort = 0;
  for (const [gid, count] of Object.entries(gidCounts)) {
    gidNodes.set(gid, []);
    for (let i = 0; i < count; i++) {
      const node = { ip, port: 7000 + 100 * gidPort + i };
      gidNodes.get(gid).push(node);
      nodes.push(node);
    }
    gidPort += 1;
  }
  const server = await new Promise((cb) => distribution.node.start(cb));
  await Promise.all(nodes.map((node) => local.status.spawn(node)));
  await Promise.all(
    [...gidNodes.entries()].map(([gid, nodes]) => createGroup({ gid }, nodes))
  );
  await beginIndex(gidNodes, "students");
  await beginIndex(gidNodes, "courses");
  const result = await job(Object.fromEntries([...gidNodes.entries()]));
  const stop = { service: "status", method: "stop" };
  await Promise.all(
    nodes.map((node) => local.comm.send([], { ...stop, node }))
  );
  await new Promise((res) => server.close(res));
  return result;
}

test(
  "stuff",
  () =>
    setup({ client: 1, students: 2, courses: 3 }, async (gidNodes) => {
      expect(gidNodes).toHaveProperty("client");
      expect(gidNodes).toHaveProperty("students");
      expect(gidNodes).toHaveProperty("courses");
      expect(gidNodes).toHaveProperty("authoritativeStudents");
      expect(gidNodes).toHaveProperty("authoritativeCourses");

      expect(gidNodes.client).toHaveLength(1);
      expect(gidNodes.students).toHaveLength(2);
      expect(gidNodes.courses).toHaveLength(3);

      expect(gidNodes.client[0]).toHaveProperty("ip");
      expect(gidNodes.client[0]).toHaveProperty("port");

      let remote;
      remote = {
        service: "students",
        method: "listTokens",
        node: gidNodes.students[0],
      };
      const r0 = await local.comm.send([], remote);
      remote = {
        service: "students",
        method: "listTokens",
        node: gidNodes.students[1],
      };
      const r1 = await local.comm.send([], remote);
      expect(r0.length + r1.length).toBe(8000);
      expect(new Set([...r0, ...r1]).size).toBe(8000);

      expect(async () => {
        // student not held here
        remote = {
          service: "students",
          method: "lock",
          node: gidNodes.students[1],
        };
        await local.comm.send(["CSCI 1380", r0[0]], remote);
      }).rejects.toThrow();

      remote = {
        service: "students",
        method: "lock",
        node: gidNodes.students[0],
      };
      const lock1380 = await local.comm.send(["CSCI 1380", r0[0]], remote);

      expect(async () => {
        // can't get the same lock twice
        remote = {
          service: "students",
          method: "lock",
          node: gidNodes.students[0],
        };
        await local.comm.send(["CSCI 1380", r0[0]], remote);
      }).rejects.toThrow();

      // different course
      remote = {
        service: "students",
        method: "lock",
        node: gidNodes.students[0],
      };
      const lock1270 = await local.comm.send(["CSCI 1270", r0[0]], remote);

      // drop the lock on 1380
      remote = {
        service: "students",
        method: "unlock",
        node: gidNodes.students[0],
      };
      await local.comm.send(["CSCI 1380", lock1380, r0[0]], remote);

      // submit on 1270
      remote = {
        service: "students",
        method: "submit",
        node: gidNodes.students[0],
      };
      await local.comm.send(["CSCI 1270", lock1270, r0[0]], remote);

      let taking;
      remote = {
        service: "students",
        method: "listRegister",
        node: gidNodes.students[0],
      };
      taking = await local.comm.send([r0[0]], remote);
      expect(taking).toEqual(["CSCI 1270"]);

      expect(async () => {
        // can't lock a course already registered for
        remote = {
          service: "students",
          method: "lock",
          node: gidNodes.students[0],
        };
        await local.comm.send(["CSCI 1270", r0[0]], remote);
      }).rejects.toThrow();

      remote = {
        service: "client",
        method: "register",
        node: gidNodes.client[0],
      };
      await local.comm.send(["AFRI 0001", r0[0]], remote);

      remote = {
        service: "students",
        method: "listRegister",
        node: gidNodes.students[0],
      };
      taking = await local.comm.send([r0[0]], remote);
      expect(taking).toEqual(
        expect.arrayContaining(["CSCI 1270", "AFRI 0001"])
      );

      // TODO: add test students to synthesize
      // TODO: test course with prerequisites
      remote = {
        service: "client",
        method: "coursesTaking",
        node: gidNodes.client[0],
      };
      taking = await local.comm.send(["AFRI 0001"], remote);
      expect(taking).toEqual(expect.arrayContaining([r0[0]]));

      remote = {
        service: "client",
        method: "studentsTaking",
        node: gidNodes.client[0],
      };
      taking = await local.comm.send([r0[0]], remote);
      expect(taking).toEqual(expect.arrayContaining(["AFRI 0001"]));
    }),
  10000
);

// --------------------------------------------------------------------------

// dummy testing for debugging purposes
test("debugging, dummy", async () => {
  // let res = await local.courses.beginIndex();
});
