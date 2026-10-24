#!/usr/bin/env node
'use strict';

/**
 * 管理员 RBAC API 冒烟测试
 */

const fs = require('fs');
const path = require('path');

const TMP_DB = path.join(__dirname, 'data', 'db.admin-rbac-test.json');
if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
process.env.DATABASE_PATH = TMP_DB;
process.env.PORT = '18789';
process.env.HOST = '127.0.0.1';

const adminRbac = require('./src/admin-rbac');
const db = require('./src/db');
const auth = require('./src/auth');

const SUPER = adminRbac.SUPER_ADMIN_PHONE;
const OTHER = '18080141668';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(base, method, urlPath, body, token) {
  const res = await fetch(base + urlPath, {
    method,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}
    ),
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function run() {
  console.log('=== Admin RBAC tests ===');
  db.reset();
  require('./src/index.js');
  const base = 'http://127.0.0.1:18789';
  await sleep(800);

  assert(adminRbac.isSuperAdminPhone(SUPER));
  assert(
    adminRbac.getEffectiveModules(db, SUPER).length === adminRbac.ALL_MODULE_KEYS.length,
    'super admin has all modules'
  );
  assert(adminRbac.getEffectiveModules(db, OTHER).length === 0, 'other has no modules by default');

  const superToken = auth.createToken('ADMIN-SUPER', 'admin', SUPER, db);
  const otherToken = auth.createToken('ADMIN-OTHER', 'admin', OTHER, db);

  const meSuper = await request(base, 'GET', '/api/auth/me', null, superToken);
  assert(meSuper.status === 200 && meSuper.json.adminRbac.isSuperAdmin, 'super me');
  assert(meSuper.json.adminRbac.modules.includes('permissions'), 'super has permissions module');

  const meOther = await request(base, 'GET', '/api/auth/me', null, otherToken);
  assert(meOther.status === 200 && !meOther.json.adminRbac.isSuperAdmin, 'other me');
  assert(meOther.json.adminRbac.modules.length === 0, 'other starts with no modules');

  const deniedPay = await request(base, 'GET', '/api/pay/orders', null, otherToken);
  assert(deniedPay.status === 403, 'other denied pay without grant');

  const grant = await request(
    base,
    'PATCH',
    '/api/admin/rbac/staff/' + OTHER,
    { modules: ['payments'] },
    superToken
  );
  assert(grant.status === 200, 'super grants payments');

  const allowedPay = await request(base, 'GET', '/api/pay/orders', null, otherToken);
  assert(allowedPay.status === 200, 'other can list pay after grant');

  const deniedStaff = await request(base, 'GET', '/api/admin/rbac/staff', null, otherToken);
  assert(deniedStaff.status === 403, 'other cannot open rbac staff');

  console.log('✓ RBAC grant / deny flows OK');
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
