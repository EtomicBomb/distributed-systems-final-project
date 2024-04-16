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
    }),
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
    [...gidNodes.entries()].map(([gid, nodes]) => createGroup({ gid }, nodes)),
  );
  await beginIndex(gidNodes, "students");
  await beginIndex(gidNodes, "courses");
  const result = await job(Object.fromEntries([...gidNodes.entries()]));
  const stop = { service: "status", method: "stop" };
  await Promise.all(
    nodes.map((node) => local.comm.send([], { ...stop, node })),
  );
  await new Promise((res) => server.close(res));
  return result;
}

test(
  "test registration dependents",
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

      // list all of the student students on both `students` nodes
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
      const totalStudents = r0.length + r1.length;
      expect(totalStudents).toBeGreaterThan(4000);
      expect(new Set([...r0, ...r1]).size).toBe(totalStudents);

      // lock a student when the student is not held here
      expect(async () => {
        remote = {
          service: "students",
          method: "lock",
          node: gidNodes.students[1],
        };
        await local.comm.send(["CSCI 1380", r0[0]], remote);
      }).rejects.toThrow();

      // lock a student when they are held heer
      remote = {
        service: "students",
        method: "lock",
        node: gidNodes.students[0],
      };
      const lock1380 = await local.comm.send(["CSCI 1380", r0[0]], remote);

      // attempt to get a lock on the same student twice
      expect(async () => {
        remote = {
          service: "students",
          method: "lock",
          node: gidNodes.students[0],
        };
        await local.comm.send(["CSCI 1380", r0[0]], remote);
      }).rejects.toThrow();

      // get a lock on a new course before the old one expires
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

      // see what courses the student is registered for
      let taking;
      remote = {
        service: "students",
        method: "listRegister",
        node: gidNodes.students[0],
      };
      taking = await local.comm.send([r0[0]], remote);
      expect(taking).toEqual(["CSCI 1270"]);

      // try to lock a course that the student is already registered for
      expect(async () => {
        remote = {
          service: "students",
          method: "lock",
          node: gidNodes.students[0],
        };
        await local.comm.send(["CSCI 1270", r0[0]], remote);
      }).rejects.toThrow();

      // end to end register for AFRI 0001
      remote = {
        service: "client",
        method: "register",
        node: gidNodes.client[0],
      };
      await local.comm.send(["AFRI 0001", r0[0]], remote);

      // check that these courses appear in the students listRegister
      remote = {
        service: "students",
        method: "listRegister",
        node: gidNodes.students[0],
      };
      taking = await local.comm.send([r0[0]], remote);
      expect(taking).toEqual(
        expect.arrayContaining(["CSCI 1270", "AFRI 0001"]),
      );

      // test that these appear in the client list register
      remote = {
        service: "client",
        method: "coursesTaking",
        node: gidNodes.client[0],
      };
      taking = await local.comm.send(["AFRI 0001"], remote);
      expect(taking).toEqual(expect.arrayContaining([r0[0]]));

      // check client that everything we expect is there
      remote = {
        service: "client",
        method: "studentsTaking",
        node: gidNodes.client[0],
      };
      taking = await local.comm.send([r0[0]], remote);
      expect(taking).toEqual(expect.arrayContaining(["AFRI 0001"]));
    }),
  10000,
);

test(
  "test registration main",
  () => setup({ client: 2, students: 3, courses: 3 }, async (gidNodes) => {}),
  10000,
);

// sample course data.  certain fields are aritificially removed as they are not
// necessary to create the inverted index
let courseData = {
  "AFRI 0001": {
    code: {
      subject: "AFRI",
      number: "0001",
    },
    title:
      "From Octavia Butler to N.K Jemisin, Black Feminist and Queer Theories in Science-Fiction and Fantasy",
    description:
      "Through the analytical lenses offered by Black feminist and queer theories, this course engages works of Black speculative fiction as modes of theorizing questions of race, gender, sexuality, class, environmental justice, interpersonal politics and more. Through course readings, seminar discussions, and creative writing projects, students will critically analyze works of speculative fiction written by Black authors and broaden their knowledge of Black speculative literature, with a particular focus on science fiction and fantasy.",
    aliases: [],
    offerings: [
      {
        date: "202200",
        section: 1,
        instructors: ["Senit Kidane"],
        enrollment: 3,
        demographics: null,
      },
    ],
  },
  "PHIL 0412": {
    code: {
      subject: "PHIL",
      number: "0412",
    },
    title: "Climate Change Ethics",
    description:
      "Climate change is commonly said to be one of the defining issues of the 21st century. Calls for, and movement towards, significant action seem to be growing. Yet what ought to be done? This is a moral question as much as, if not more so, than an economic, political, or scientific question. In this course, then, we will consider climate change from the point of view of moral philosophy.",
    aliases: [],
    offerings: [
      {
        date: "202210",
        section: 1,
        instructors: ["Marc Hewitt"],
        enrollment: 10,
        demographics: {
          freshmen: 0,
          sophomores: 0,
          juniors: 4,
          seniors: 0,
          graduates: 0,
          others: 6,
        },
      },
    ],
  },
  "HIST 1360": {
    code: {
      subject: "HIST",
      number: "1360",
    },
    title: "Amazonia from the Prehuman to the Present",
    description:
      "This course merging lecture and discussions will examine the fascinating and contested history of one of the world’s most complex fluvial ecosystems: Amazonia, in equatorial South America, from its pre-human history to the present day. The course will include readings and discussions on the region’s ecological origins; the social history of its diverse Indigenous and immigrant populations, including African-descended peoples; exploration myths and European colonial projects; and more recent efforts to exploit and protect Amazonia’s extraordinary natural and human resources. The course will use tools and resources from archaeology, anthropology, biology, and social and cultural history, and will also examine popular representations of the Amazon through novels, newspapers, podcasts, and film.",
    aliases: [
      {
        subject: "ARCH",
        number: "1242",
      },
    ],
    offerings: [
      {
        instructors: ["Neil Safier"],
      },
      {
        instructors: ["Neil F Safier"],
      },
    ],
  },
};
let courses = new Map(Object.entries(courseData));

test("termFreq", async () => {
  // create inverted index from objs
  let tf = distribution.util.termFreq(courses);
});

test("idf", async () => {
  // create inverted index from objs
  let idf = distribution.util.tfidf(courses);
});

// --------------------------------------------------------------------------

// dummy testing for debugging purposes
test("debugging, dummy", async () => {
  // let res = await local.courses.beginIndex();
});
