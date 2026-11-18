#!/usr/bin/env node
'use strict';

/**
 * 运营中台：家长 / 导师的添加、删除、权限与删除保护。
 */

const fs = require('fs');
const path = require('path');

const TMP_DB = path.join(__dirname, 'data', 'db.admin-users-test.json');
if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
process.env.DATABASE_PATH = TMP_DB;
process.env.PORT = '18790';
process.env.HOST = '127.0.0.1';

const db = require('./src/db');
const auth = require('./src/auth');

const SUPER = '13540012341';
const LIMITED = '18080141668';

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

function assertMidPlatformCopy() {
  const root = path.resolve(__dirname, '../..');
  const appJs = fs.readFileSync(path.join(root, 'admin-saas/js/admin-app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'admin-saas/index.html'), 'utf8');
  const storage = fs.readFileSync(path.join(root, 'js/storage-service.js'), 'utf8');
  assert(appJs.indexOf('当前登录已不是管理员，请重新登录中台') >= 0, 'mid-platform shows re-login copy');
  assert(
    appJs.indexOf('state.adminRbac.isSuperAdmin || state.adminRbac.isPrimaryAdmin') >= 0,
    'module check treats primary admin like super admin'
  );
  assert(appJs.indexOf("raw === '需要管理员权限'") >= 0, 'old admin-permission text is rewritten in the UI');
  assert(html.indexOf('id="adminIdentity"') >= 0, 'top bar shows the active session');
  assert(html.indexOf('id="adminSessionStatus"') >= 0, 'top bar states whether the session is still admin');
  assert(html.indexOf('>重新登录中台<') >= 0, 'top bar offers 重新登录中台');
  assert(appJs.indexOf('会话已不是管理员') >= 0, 'replaced session is labeled in the top bar');
  assert(appJs.indexOf('当前会话已被') >= 0, 'parent or tutor overwrite is named in the top bar');
  assert(appJs.indexOf('管理员会话') >= 0, 'an admin session is labeled in the top bar');
  const nonAdmin = appJs.slice(appJs.indexOf("if (me.role !== 'admin')"));
  const bindAt = nonAdmin.indexOf('bindLogout()');
  const returnAt = nonAdmin.indexOf('return false');
  assert(bindAt >= 0 && returnAt >= 0 && bindAt < returnAt, 'logout is bound before ensureAdmin returns false');
  assert(nonAdmin.indexOf('bindRelogin(') >= 0 && nonAdmin.indexOf('bindRelogin(') < returnAt, 're-login is bound before ensureAdmin returns false');
  assert(appJs.indexOf('await StorageService.logout()') >= 0, '重新登录中台 clears the current token');
  assert(html.indexOf('data-admin-relogin') >= 0, 'top bar re-login entry clears the token before navigation');
  assert(!/session\.role = role \|\| user\.role/.test(storage), 'login does not keep the requested role over the server role');
  assert(storage.indexOf('user.role || role') >= 0, 'login keeps the server-issued role');
}

async function run() {
  console.log('=== Admin parent/mentor user tests ===');
  assertMidPlatformCopy();
  db.reset();
  require('./src/index.js');
  const base = 'http://127.0.0.1:18790';
  await sleep(800);

  const superToken = auth.createToken('ADMIN-SUPER', 'admin', SUPER, db);
  const limitedToken = auth.createToken('ADMIN-LIMITED', 'admin', LIMITED, db);
  const parentToken = auth.createToken('PAR-DEMO-001', 'parent', '13980889211', db);

  const anon = await request(base, 'POST', '/api/admin/parents', { phone: '13700001001' }, null);
  assert(anon.status === 401, 'anonymous create rejected');

  const parentCaller = await request(
    base,
    'POST',
    '/api/admin/parents',
    { phone: '13700001001', parentName: '陈女士', studentNickname: '小陈' },
    parentToken
  );
  assert(parentCaller.status === 403, 'parent cannot create parents');
  assert(
    parentCaller.json.error === '当前登录已不是管理员，请重新登录中台',
    'non-admin parent session is told to log in again'
  );

  const mentorToken = auth.createToken('AP-MENTOR-CALLER', 'mentor', '13800001111', db);
  const mentorCaller = await request(
    base,
    'POST',
    '/api/admin/mentors',
    { phone: '13700001009', realName: '周老师' },
    mentorToken
  );
  assert(mentorCaller.status === 403, 'mentor cannot create mentors');
  assert(
    mentorCaller.json.error === '当前登录已不是管理员，请重新登录中台',
    'non-admin mentor session is told to log in again'
  );

  const stalePrimaryParent = auth.createToken('STALE-PRIMARY-P', 'parent', SUPER, db);
  const staleParentAdd = await request(
    base,
    'POST',
    '/api/admin/parents',
    { phone: '13700001021', parentName: '主管理员补录', studentNickname: '小主' },
    stalePrimaryParent
  );
  assert(
    staleParentAdd.status === 200 && staleParentAdd.json.id,
    'primary phone can add a parent even when the token role is parent'
  );
  const stalePrimaryMentor = auth.createToken('STALE-PRIMARY-M', 'mentor', SUPER, db);
  const staleMentorAdd = await request(
    base,
    'POST',
    '/api/admin/mentors',
    { phone: '13700001022', realName: '主管理员导师' },
    stalePrimaryMentor
  );
  assert(
    staleMentorAdd.status === 200 && staleMentorAdd.json.id,
    'primary phone can add a mentor even when the token role is mentor'
  );
  const staleMe = await request(base, 'GET', '/api/auth/me', null, stalePrimaryParent);
  assert(
    staleMe.status === 200 && staleMe.json.role === 'admin' && staleMe.json.adminRbac.isPrimaryAdmin,
    'auth/me reports the primary phone as the main admin'
  );

  const staleLimited = auth.createToken('STALE-LIMITED', 'parent', LIMITED, db);
  const limitedAsParentRole = await request(
    base,
    'POST',
    '/api/admin/parents',
    { phone: '13700001023', parentName: '不该成功', studentNickname: '小限' },
    staleLimited
  );
  assert(limitedAsParentRole.status === 403, 'ordinary admin still needs the parents module');
  assert(
    String(limitedAsParentRole.json.error || '').indexOf('无权访问') >= 0,
    'ordinary admin is not given every module'
  );

  const noModule = await request(
    base,
    'POST',
    '/api/admin/parents',
    { phone: '13700001001', parentName: '陈女士', studentNickname: '小陈' },
    limitedToken
  );
  assert(noModule.status === 403, 'admin without parents module cannot create');

  await request(
    base,
    'PATCH',
    '/api/admin/rbac/staff/' + LIMITED,
    { modules: ['parents'] },
    superToken
  );

  const missing = await request(
    base,
    'POST',
    '/api/admin/parents',
    { phone: '13700001001', parentName: '陈女士' },
    superToken
  );
  assert(missing.status === 400 && missing.json.code === 'STUDENT_REQUIRED', 'student nickname required');

  const badPhone = await request(
    base,
    'POST',
    '/api/admin/parents',
    { phone: '12345', parentName: '陈女士', studentNickname: '小陈' },
    superToken
  );
  assert(badPhone.status === 400 && badPhone.json.code === 'INVALID_PHONE', 'phone validated');

  const created = await request(
    base,
    'POST',
    '/api/admin/parents',
    {
      phone: '13700001001',
      parentName: '陈女士',
      studentNickname: '小陈',
      studentGrade: '初二',
      parentRole: '妈妈'
    },
    limitedToken
  );
  assert(created.status === 200 && created.json.id, 'parents module can add parent');
  assert(created.json.phone === '13700001001' && created.json.parentName === '陈女士', 'required fields stored');
  assert(created.json.studentNickname === '小陈', 'student nickname stored');
  assert(!created.json.password, 'no password field');

  const dup = await request(
    base,
    'POST',
    '/api/admin/parents',
    { phone: '13700001001', parentName: '重复', studentNickname: '重复' },
    superToken
  );
  assert(dup.status === 400 && dup.json.code === 'PHONE_TAKEN', 'duplicate parent phone rejected');

  const ticket = auth.createVerificationTicket('13700001001', false);
  const login = await request(base, 'POST', '/api/auth/login', { ticket, role: 'parent' });
  assert(login.status === 200 && login.json.token, 'staff-created parent can OTP login');

  const session = auth.createToken(created.json.id, 'parent', '13700001001', db);
  const seedBlocked = await request(base, 'DELETE', '/api/admin/parents/PAR-DEMO-001', null, superToken);
  assert(seedBlocked.status === 400 && seedBlocked.json.code === 'USER_DELETE_BLOCKED', 'active bookings block parent delete');
  assert(db.getParents().some((p) => p.id === 'PAR-DEMO-001'), 'blocked parent remains');

  const mentorNoModule = await request(
    base,
    'POST',
    '/api/admin/mentors',
    { phone: '13700001002', realName: '周老师' },
    limitedToken
  );
  assert(mentorNoModule.status === 403, 'parents-only admin cannot add mentor');

  const mentor = await request(
    base,
    'POST',
    '/api/admin/mentors',
    { phone: '13700001002', realName: '周老师', university: '四川大学', hourlyRate: 150 },
    superToken
  );
  assert(mentor.status === 200 && mentor.json.status === 'pending', 'mentor created as pending');
  assert(mentor.json.realName === '周老师' && mentor.json.phone === '13700001002', 'mentor fields stored');
  assert(!mentor.json.password, 'mentor has no password');

  const cross = await request(
    base,
    'POST',
    '/api/admin/mentors',
    { phone: '13700001001', realName: '不该成功' },
    superToken
  );
  assert(cross.status === 400 && cross.json.code === 'PHONE_TAKEN_PARENT', 'parent phone cannot become mentor');

  const proofMentor = db.getMentorById('AP-8801');
  assert(proofMentor && proofMentor.proofFiles && proofMentor.proofFiles.length, 'seed mentor has materials');
  const dropProof = await request(base, 'DELETE', '/api/admin/mentors/AP-8801', null, superToken);
  assert(dropProof.status === 200, 'mentor without active bookings can be deleted');
  assert(!db.getMentors().some((m) => m.id === 'AP-8801'), 'deleted mentor hidden from live list');
  const archived = db.snapshot().mentors.find((m) => m.id === 'AP-8801');
  assert(archived && archived.deletedAt && archived.proofFiles.length, 'materials kept on soft-deleted mentor');

  const busyMentor = await request(base, 'DELETE', '/api/admin/mentors/AP-8802', null, superToken);
  assert(busyMentor.status === 400 && busyMentor.json.code === 'USER_DELETE_BLOCKED', 'active bookings block mentor delete');
  assert(db.getMentorById('AP-8802'), 'busy mentor remains');

  const parentBookingsBefore = db.getBookings().filter((b) => b.parentId === created.json.id).length;
  const removedParent = await request(base, 'DELETE', '/api/admin/parents/' + created.json.id, null, superToken);
  assert(removedParent.status === 200, 'idle parent deleted');
  assert(!db.getParents().some((p) => p.id === created.json.id), 'parent hidden after delete');
  const parentArchive = db.snapshot().parents.find((p) => p.id === created.json.id);
  assert(parentArchive && parentArchive.deletedAt, 'parent row soft-deleted');
  assert(
    db.getBookings().filter((b) => b.parentId === created.json.id).length === parentBookingsBefore,
    'no bookings invented or removed'
  );
  const deadSession = await request(base, 'GET', '/api/auth/me', null, session);
  assert(deadSession.status === 401, 'deleted parent session revoked');
  const relogTicket = auth.createVerificationTicket('13700001001', false);
  const relog = await request(base, 'POST', '/api/auth/login', { ticket: relogTicket, role: 'parent' });
  assert(relog.status === 404, 'deleted parent must register again');

  const held = await request(
    base,
    'POST',
    '/api/admin/parents',
    { phone: '13700001004', parentName: '钱女士', studentNickname: '小钱' },
    superToken
  );
  assert(held.status === 200, 'second parent created');
  const heldBooking = {
    id: 'BK-USER-HELD',
    parentId: held.json.id,
    parentPhone: '13700001004',
    mentorId: 'AP-8802',
    tutorId: 'AP-8802',
    status: 'completed',
    escrowStatus: 'released',
    paymentStatus: 'paid',
    subject: '初中数学',
    space: '高新大源中央微网点'
  };
  const bookings = db.getBookings();
  bookings.push(heldBooking);
  db.replaceSnapshot({ bookings });
  db.savePayOrder({
    outTradeNo: 'PAY-USER-HELD',
    bookingId: 'BK-USER-HELD',
    parentPhone: '13700001004',
    status: 'refund_pending',
    amountYuan: 100
  });
  const heldDelete = await request(base, 'DELETE', '/api/admin/parents/' + held.json.id, null, superToken);
  assert(heldDelete.status === 400 && heldDelete.json.code === 'USER_DELETE_BLOCKED', 'open refund blocks delete');
  assert(heldDelete.json.orderIds && heldDelete.json.orderIds.indexOf('PAY-USER-HELD') >= 0, 'order id returned');
  assert(db.getPayOrder('PAY-USER-HELD'), 'pay order not deleted');
  assert(db.getBookings().some((b) => b.id === 'BK-USER-HELD'), 'completed booking not deleted');

  db.savePayOrder({
    outTradeNo: 'PAY-USER-HELD',
    bookingId: 'BK-USER-HELD',
    parentPhone: '13700001004',
    status: 'REFUNDED',
    amountYuan: 100
  });
  const afterRefund = await request(base, 'DELETE', '/api/admin/parents/' + held.json.id, null, superToken);
  assert(afterRefund.status === 200, 'delete allowed after order is terminal');
  assert(db.getPayOrder('PAY-USER-HELD').status === 'REFUNDED', 'financial record kept');
  assert(db.getBookings().some((b) => b.id === 'BK-USER-HELD'), 'booking record kept');

  const asAdmin = await request(
    base,
    'POST',
    '/api/admin/rbac/staff',
    { phone: '13700001004' },
    superToken
  );
  assert(asAdmin.status === 200, 'phone can be added as admin after the parent record is removed');
  assert(auth.isAdminPhone('13700001004'), 'provisioned admin phone is recognized');

  console.log('✓ Parent/mentor add, delete, permission and safeguards OK');
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
