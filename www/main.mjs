#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import Koa from 'koa';
import Router from '@koa/router';
import { koaBody } from 'koa-body';
import util from '../distribution/util/util.js';
const { serialize, deserialize } = util;
import fetch from 'node-fetch';

const app = new Koa();
const router = new Router();

router.get('/', async (ctx, next) => {
    ctx.body = await readFile('www/index.html');
    ctx.type = 'text/html';
});

router.get('/index.css', async (ctx, next) => {
    ctx.body = await readFile('www/index.css');
    ctx.type = 'text/css';
});

router.get('/favicon.ico', async (ctx, next) => {
    ctx.body = await readFile('www/favicon.ico');
    ctx.type = 'text/css';
});

router.post('/search', async (ctx, next) => {
    const {query, course, department} = ctx.request.body;
//    await new Promise(res => setTimeout(res, 500));
    ctx.body = await forward('/client/search', query, course, department);
    ctx.type = 'text/html';
});

router.post('/register', async (ctx, next) => {
    const {code, token} = ctx.request.body;
//    await new Promise(res => setTimeout(res, 500));
    ctx.body = await forward('/client/register', code, token);
    ctx.type = 'text/html';
});

app.use(koaBody());
app.use(router.routes());
app.use(router.allowedMethods());
app.listen(80);

async function forward(pathname, ...args) {

    const url = new URL(pathname, 'http://127.0.0.1:8080/');
    const method = 'POST';
    const body = serialize([...args]);
    try {
        let result = await fetch(url, {method, body});
        result = await result.text();
        result = deserialize(result);
        return `${result}`;
    } catch (e) {
        return `${e}`;
    }
}

