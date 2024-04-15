#!/usr/bin/env node

const { readFile, writeFile } = require("node:fs/promises");
const { randomUUID } = require("node:crypto");

function randomStudent(courses, names, index) {
  const semester = Math.floor(Math.random() * 15);
  let taken = 4 * semester;
  taken = new Array(taken).fill(null).map(() => {
    let index = Math.floor(Math.random() * courses.length);
    return courses[index];
  });
  const name = Math.floor(Math.random() * names.length);
  return [
    `student-${randomUUID()}`,
    {
      name: names[name],
      semester: semester,
      taken,
    },
  ];
}

async function create(count) {
  let names = await readFile("names.txt");
  names = names.toString().split("\n");
  let courses = await readFile("courses.json");
  courses = Object.keys(JSON.parse(courses));
  let students = new Array(count)
    .fill(null)
    .map((_, index) => randomStudent(courses, names, index));
  students = Object.fromEntries(students);
  students = {
    "student-test-0": {
      semester: 0,
      name: "Test",
      taken: [],
    },
    "student-test-1": {
      semester: 1,
      name: "Test",
      taken: ["CSCI 0330"],
    },
    "student-test-2": {
      semester: 1,
      name: "Test",
      taken: ["CSCI 1660"],
    },
    ...students,
  };
  await writeFile("students.json", JSON.stringify(students));
}

create(8000).then();
