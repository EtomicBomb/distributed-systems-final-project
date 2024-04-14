#!/usr/bin/env node

const {readFile, writeFile} = require('node:fs/promises');
const {randomUUID} = require('node:crypto');

function randomStudent(courses, names) {
  const semester = Math.floor(Math.random() * 15);
  let taken = 4 * semester;
  taken = new Array(taken).fill(null).map(() => {
    let index = Math.floor(Math.random() * courses.length);
    return courses[index];
  });
  const name = Math.floor(Math.random() * names.length);
  return [`stud_${randomUUID()}`, {
    name: names[name],
    semester: semester,
    taken,
  }];
}

async function create(count) {
  let names = await readFile('names.txt');
  names = names.toString().split('\n');
  let courses = await readFile('courses.json');
  courses = Object.keys(JSON.parse(courses));
  let students = new Array(count).fill(null).map(() => randomStudent(courses, names));
  students = Object.fromEntries(students);
  await writeFile('students.json', JSON.stringify(students));
}

create(8000).then();
