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
    ctx.type = 'image/x-icon';
});

router.post('/search', async (ctx, next) => {
    const {query, course, department} = ctx.request.body;
    ctx.body = await forward(renderSearch, '/client/search', query, course, department);
    ctx.type = 'text/html';
});

router.post('/register', async (ctx, next) => {
    const {code, token} = ctx.request.body;
    ctx.body = await forward(renderRegister, '/client/register', code, token);
    ctx.type = 'text/html';
});

app.use(koaBody());
app.use(router.routes());
app.use(router.allowedMethods());
app.listen(80);

async function forward(render, pathname, ...args) {
    const url = new URL(pathname, 'http://127.0.0.1:8080/');
    const method = 'POST';
    const body = serialize([...args]);
    try {
        let result = await fetch(url, {method, body});
        result = await result.text();
        const [e, v] = deserialize(result);
        if (e) {
            throw e;
        }
        return render(v);
    } catch (error) {
        return renderError(error);
    }
}

function renderError(error) {
    let prefix = '';
    let ret = '';
    while (error) {
        ret += prefix + error.message;
        error = error.cause;
        prefix = ': ';
    }
    return ret;
}

function renderSearch(results) {
    return String.prototype.concat(...results.map(([code, detail]) => `
        <article>
            <h3>${code}: ${detail.title}</h3>
            <p>${detail.description}</p>
        </article>
    `));
}

function renderRegister(result) {
    return `<p>registration successful</p>`;
}
