#!/usr/bin/env node
'use strict';

/**
 * Admin console fixes: pay order filters + assessment detail API.
 */
const fs = require('fs');
const path = require('path');
const auth = require('./src/auth');
const db = require('./src/db');

const ROOT = path.resolve(__dirname, '../..');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureApi() {
  process.env.PORT = '18788';
  process.env.HOST = '127.0.0.1';
  require('./src/index.js');
  await sleep(900);
  return 'http://127.0.0.1:18788';
}

async function request(base, method, pathName, body, token) {
  const res = await fetch(base + pathName, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assertAdminApiTokenParsing() {
  const src = fs.readFileSync(path.join(ROOT, 'admin-saas/js/admin-api.js'), 'utf8');
  if (!src.includes('JSON.parse(raw)')) {
    throw new Error('admin-api.js must JSON.parse auth token from localStorage');
  }
  if (!src.includes('StorageService.getAuthToken')) {
    throw new Error('admin-api.js should prefer StorageService.getAuthToken');
  }
}

async function main() {
  assertAdminApiTokenParsing();

  const adminTok = auth.createToken('ADMIN-CONSOLE', 'admin', '13540012341', db);
  const base = await ensureApi();

  const saved = db.saveAssessment({
    subject: '数学',
    score: 88,
    parentId: 'P-test',
    studentNickname: '测试学员',
    answers: [{ question: '1+1=?', selectedText: '2', correctText: '2', correct: true }]
  });
  if (!saved || !saved.id) throw new Error('saveAssessment failed');

  const detail = await request(base, 'GET', '/api/assessments/' + encodeURIComponent(saved.id), null, adminTok);
  if (detail.status !== 200 || !detail.json.answers) {
    throw new Error('admin assessment detail failed');
  }

  const orders = await request(base, 'GET', '/api/pay/orders?mentorName=李&limit=10', null, adminTok);
  if (orders.status !== 200 || !Array.isArray(orders.json.orders)) {
    throw new Error('pay orders list failed');
  }

  console.log('test-admin-console-fixes: OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('test-admin-console-fixes: FAIL', e.message);
  process.exit(1);
});
