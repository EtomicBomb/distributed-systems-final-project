#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import Koa from 'koa';
import Router from '@koa/router';
import { koaBody } from 'koa-body';
import util from '../distribution/util/util.js';
const { serialize, deserialize } = util;
import fetch from 'node-fetch';

const apiPort = 8080;
const apiHostname = '127.0.0.1';

const app = new Koa();
const router = new Router();

router.get('/', async (ctx, next) => {
    ctx.body = await readFile('index.html');
    ctx.type = 'text/html';
});

router.get('/index.css', async (ctx, next) => {
    ctx.body = await readFile('index.css');
    ctx.type = 'text/css';
});

router.post('/search', async (ctx, next) => {
    const url = new URL(ctx.request.URL);
    console.trace(url);
    url.port = apiPort;
    url.hostname = apiHostname; 
    url.pathname = '/client/search';

    const {query, course, department} = ctx.request.body;

    const method = 'POST';
    const body = serialize([query, course, department]);
    try {
        let result = await fetch(url, {method, body});
        result = await result.text();
        result = deserialize(result);
        ctx.body = `${result}`;
    } catch (e) {
        ctx.body = `${e}`;
    }
    ctx.type = 'text/html';
});

router.post('/register', async (ctx, next) => {
    const url = new URL(ctx.request.URL);
    url.port = apiPort;
    url.hostname = apiHostname; 
    url.pathname = '/client/register';
    console.trace(url);

    const {code, token} = ctx.request.body;

    const method = 'POST';
    const body = serialize([code, token]);
    try {
        let result = await fetch(url, {method, body});
        result = await result.text();
        result = deserialize(result);
        ctx.body = `${result}`;
    } catch (e) {
        ctx.body = `${e}`;
    }
    ctx.type = 'text/html';
});

app.use(koaBody());
app.use(router.routes())
app.use(router.allowedMethods());
app.listen(8000);
