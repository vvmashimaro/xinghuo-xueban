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

  const grantPerm = await request(
    base,
    'PATCH',
    '/api/admin/rbac/staff/' + OTHER,
    { modules: ['permissions', 'payments'] },
    superToken
  );
  assert(grantPerm.status === 200, 'super grants permissions module');
  const otherCanList = await request(base, 'GET', '/api/admin/rbac/staff', null, otherToken);
  assert(otherCanList.status === 200, 'permissions module can list staff');

  const newbie = '13900001001';
  const otherAdd = await request(base, 'POST', '/api/admin/rbac/staff', { phone: newbie }, otherToken);
  assert(otherAdd.status === 403, 'non-primary cannot add admin');
  assert(String(otherAdd.json.error || '').indexOf('主管理员') >= 0, '403 explains primary admin');

  const otherDel = await request(base, 'DELETE', '/api/admin/rbac/staff/' + newbie, null, otherToken);
  assert(otherDel.status === 403, 'non-primary cannot remove admin');

  const addPrimary = await request(base, 'POST', '/api/admin/rbac/staff', { phone: SUPER }, superToken);
  assert(addPrimary.status === 400 && addPrimary.json.code === 'IS_PRIMARY', 'cannot re-add primary');

  const addDup = await request(base, 'POST', '/api/admin/rbac/staff', { phone: OTHER }, superToken);
  assert(addDup.status === 400 && addDup.json.code === 'ALREADY_ADMIN', 'cannot add existing admin');

  const added = await request(base, 'POST', '/api/admin/rbac/staff', { phone: newbie }, superToken);
  assert(added.status === 200 && added.json.phone === newbie, 'primary adds admin');
  assert(added.json.modules && added.json.modules.length === 0, 'new admin has no modules');
  assert(!added.json.isPrimaryAdmin, 'new admin is not primary');
  assert(auth.isAdminPhone(newbie), 'new admin phone can log in');

  const staff = await request(base, 'GET', '/api/admin/rbac/staff', null, superToken);
  const newbieRow = (staff.json.staff || []).find((row) => row.phone === newbie);
  const primaryRow = (staff.json.staff || []).find((row) => row.phone === SUPER);
  assert(newbieRow && !newbieRow.isPrimaryAdmin && newbieRow.modules.length === 0, 'staff list shows empty modules');
  assert(primaryRow && primaryRow.isPrimaryAdmin && primaryRow.isSuperAdmin, 'primary flagged once');

  const newbieToken = auth.createToken('ADMIN-' + newbie, 'admin', newbie, db);
  const newbieMe = await request(base, 'GET', '/api/auth/me', null, newbieToken);
  assert(newbieMe.status === 200 && newbieMe.json.role === 'admin', 'new admin session works');
  assert(!newbieMe.json.adminRbac.isPrimaryAdmin, 'session is not primary');

  const delSelf = await request(base, 'DELETE', '/api/admin/rbac/staff/' + SUPER, null, superToken);
  assert(delSelf.status === 400 && delSelf.json.code === 'PRIMARY_PROTECTED', 'cannot remove primary / self');
  assert(auth.isAdminPhone(SUPER), 'primary still admin');

  const removed = await request(base, 'DELETE', '/api/admin/rbac/staff/' + newbie, null, superToken);
  assert(removed.status === 200, 'primary removes admin');
  assert(!auth.isAdminPhone(newbie), 'removed phone cannot log in');
  const afterRemove = await request(base, 'GET', '/api/auth/me', null, newbieToken);
  assert(afterRemove.status === 401, 'revoked admin session is dead');
  const staffAfter = await request(base, 'GET', '/api/admin/rbac/staff', null, superToken);
  assert(!(staffAfter.json.staff || []).some((row) => row.phone === newbie), 'removed admin hidden');
  assert((staffAfter.json.staff || []).some((row) => row.phone === SUPER), 'primary remains');

  const relogTicket = auth.createVerificationTicket(newbie, false);
  const relog = await request(base, 'POST', '/api/auth/login', { ticket: relogTicket, role: 'admin' });
  assert(relog.status === 403, 'removed admin OTP login rejected');

  const readded = await request(base, 'POST', '/api/admin/rbac/staff', { phone: newbie }, superToken);
  assert(readded.status === 200 && auth.isAdminPhone(newbie), 'revoked admin can be added again');

  console.log('✓ RBAC grant / deny flows OK');
  console.log('✓ Primary admin add/remove safeguards OK');
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
