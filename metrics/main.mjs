#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import util from '../backend/distribution/util/util.js';
const { serialize, deserialize } = util;
import fetch from 'node-fetch';

let clients = await readFile('deploy/client.json');
clients = JSON.parse(clients).map(client => `http://${client.public}`);

let students = await readFile('data/students.json');
students = Object.keys(JSON.parse(students));

let courses = await readFile('data/courses.json');
courses = Object.keys(JSON.parse(courses));


let args;
args = {query: '', course: 'CSCI 1380', department: ''};
//console.log(await timeSearch(1, clients, courses, students, args));
//console.log(await timeSearch(1, clients, courses, students, args));
//console.log(await timeSearch(100, clients, courses, students, args));

args = {query: 'distributed systems', course: '', department: ''};
//console.log(await timeSearch(10, clients, courses, students, args));
//console.log(await timeSearch(100, clients, courses, students, args));

//console.log(await timeRegister(1, clients, courses, students));
////console.log(await timeRegister(1, clients, courses, students));
//console.log(await timeRegister(100, clients, courses, students));
//console.log(await timeRegister(1000, clients, courses, students));

// cold start: searching course: 'CSCI 1380'. took 8516.539943
// subsequent identical search

// await timeSearch(10, clients, courses, students) 109.88326800000004 51.78537399999993
// cold start: 

const times = [];
for (let i = 0; i < 1000; i++) {
    const time = await timeSearch(1, clients, courses, students, args);
//    const time = await timeRegister(1, clients, courses, students);
    times.push(time);
}
console.log(times.join('\n'));

async function request(client, pathname, args) {
    const url = new URL(pathname, client);
    const method = 'POST';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const body = new URLSearchParams(args);
    let result = await fetch(url, {method, body, headers});
    result = await result.text();
    return result;
}
async function timeSearch(count, clients, courses, students, args) {
    let requests = new Array(count).fill(null)
        .map(() => {
            const client = clients[Math.floor(Math.random() * clients.length)];
            return client;
        });

    const start = performance.now();
    requests = await Promise.all(requests.map((client) => request(client, '/search', args)));
    const time = performance.now() - start;
    return time;
}

async function timeRegister(count, clients, courses, students) {
    let requests = new Array(count).fill(null)
        .map(() => {
            const client = clients[Math.floor(Math.random() * clients.length)];
            const token = students[Math.floor(Math.random() * students.length)];
            const code = courses[Math.floor(Math.random() * courses.length)];
            return [client, {token, code}];
        });

    const start = performance.now();
    requests = await Promise.all(requests.map(([client, args]) => request(client, '/register', args)));
    return performance.now() - start;
}
