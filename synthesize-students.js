#!/usr/bin/env node

const {readFile, writeFile} = require('node:fs/promises');
const {randomUUID, randomFill} = require('node:crypto');

function randomStudent(courses, names) {
    const semester = Math.floor(Math.random() * 14);
    let taken = 4 * semester;
    taken = new Array(taken).fill(null).map(() => {
        let index = Math.floor(Math.random() * courses.length);
        return courses[index];
    });
    const studentToken = randomUUID();
    const name = Math.floor(Math.random() * names.length);
    return [studentToken, {
        name: names[name],
        studentToken,
        semester: semester + 1,
        taken,
    }];
}

async function create(count) {
    let names = await readFile('names.txt');
    names = names.toString().split('\n');
    let courses = await readFile('courses.json');
    courses = Object.values(JSON.parse(courses)).map(v => v.code);
    let students = new Array(count).fill(null).map(() => randomStudent(courses, names));
    students = Object.fromEntries(students);
    await writeFile('students.json', JSON.stringify(students));
}

create(8000).then();
