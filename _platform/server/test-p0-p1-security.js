#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TMP_DB = path.join(__dirname, 'data', 'db.p0-p1-security.json');
if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
process.env.DATABASE_PATH = TMP_DB;
process.env.PORT = '18790';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'development';
process.env.SMS_PROVIDER = 'mock';
process.env.SMS_COOLDOWN_MS = '0';
process.env.ADMIN_TOKEN = 'static-admin-token-p0p1-test';
process.env.ALLOW_MOCK_PAY = 'true';

const db = require('./src/db');
const auth = require('./src/auth');
const sms = require('./src/sms');
const proofUpload = require('./src/proof-upload');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(base, method, urlPath, body, token, extraHeaders) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {},
    extraHeaders || {}
  );
  const res = await fetch(base + urlPath, {
    method,
    headers,
    body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

function sessionFar() {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    date: `${y}-${m}-${day}`,
    weekday: 0,
    timeStart: '19:00',
    timeEnd: '21:00',
    status: 'scheduled',
    escrowStatus: 'frozen'
  };
}

async function main() {
  console.log('=== P0/P1 security tests ===');
  db.reset();
  require('./src/index.js');
  const base = 'http://127.0.0.1:18790';
  await sleep(800);

  const parent = db.getParents()[0];
  const mentor = db.getMentors().find((m) => m.status === 'approved') || db.getMentors()[0];
  assert(parent && mentor, 'seed parent/mentor');

  const parentToken = auth.createToken(parent.id, 'parent', parent.phone, db);
  const mentorToken = auth.createToken(mentor.id, 'mentor', mentor.phone, db);
  const adminToken = auth.createToken('ADMIN-SEC', 'admin', '13540012341', db);

  // P0-01 notify: missing local order
  const missing = await request(base, 'POST', '/api/pay/wechat/notify', {
    out_trade_no: 'BK-NOT-EXIST-1',
    trade_state: 'SUCCESS',
    amount: { total: 100 }
  });
  assert.strictEqual(missing.json.code, 'FAIL');
  assert.ok(missing.status >= 400, 'missing order is not silently accepted');
  console.log('✓ P0-01 notify rejects unknown out_trade_no');

  const sess = sessionFar();
  const booking = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    subject: '初中数学',
    space: '青羊金沙文化微网点',
    hours: 2,
    type: 'one_off',
    sessions: [sess],
    schedule: sess.date + ' 周日 19:00-21:00'
  });
  assert(booking && booking.id, 'booking created');
  const outTradeNo = `BK-${booking.id}-${Date.now()}`;
  db.savePayOrder({
    outTradeNo,
    bookingId: booking.id,
    amount: 20000,
    amountYuan: 200,
    status: 'NOTPAY',
    mock: true
  });

  const mismatch = await request(base, 'POST', '/api/pay/wechat/notify', {
    out_trade_no: outTradeNo,
    trade_state: 'SUCCESS',
    transaction_id: 'wx-bad',
    amount: { total: 1 }
  });
  assert.strictEqual(mismatch.json.code, 'FAIL');
  assert.strictEqual(db.getPayOrder(outTradeNo).status, 'NOTPAY');
  console.log('✓ P0-01 notify rejects amount mismatch');

  const paid = await request(base, 'POST', '/api/pay/wechat/notify', {
    out_trade_no: outTradeNo,
    trade_state: 'SUCCESS',
    transaction_id: 'wx-ok',
    success_time: new Date().toISOString(),
    amount: { total: 20000 }
  });
  assert.strictEqual(paid.json.code, 'SUCCESS');
  assert.strictEqual(db.getPayOrder(outTradeNo).status, 'SUCCESS');
  const paidAgain = await request(base, 'POST', '/api/pay/wechat/notify', {
    out_trade_no: outTradeNo,
    trade_state: 'SUCCESS',
    transaction_id: 'wx-ok-2',
    amount: { total: 20000 }
  });
  assert.strictEqual(paidAgain.json.code, 'SUCCESS');
  console.log('✓ P0-01 notify amount match + idempotent SUCCESS');

  // P0-02 mentor self-approve / bank bypass
  const selfApprove = await request(
    base,
    'PATCH',
    '/api/mentors/' + mentor.id,
    { status: 'approved', evalGrade: 'V3 首席导师', id: 'HACKED' },
    mentorToken
  );
  assert.strictEqual(selfApprove.status, 200);
  assert.notStrictEqual(selfApprove.json.id, 'HACKED');
  assert.notStrictEqual(selfApprove.json.evalGrade, 'V3 首席导师');
  console.log('✓ P0-02 mentor cannot self-approve or rewrite id');

  const bankPatch = await request(
    base,
    'PATCH',
    '/api/mentors/' + mentor.id,
    { bankCardNumber: '6222020000000000', bankName: '测试银行' },
    mentorToken
  );
  assert.strictEqual(bankPatch.status, 200);
  assert.strictEqual(bankPatch.json.status, 'pending');
  assert.ok(bankPatch.json.sensitiveChangePending);
  console.log('✓ P0-02 bank card change forces review');

  const otherParent = db.getParents().find((p) => p.id !== parent.id) || db.saveParent({
    id: 'PAR-OTHER-SEC',
    phone: '13900006666',
    studentNickname: '别人家孩子'
  });
  const steal = await request(
    base,
    'POST',
    '/api/parents',
    { id: otherParent.id, phone: otherParent.phone, studentNickname: '被篡改' },
    parentToken
  );
  assert.strictEqual(steal.status, 200);
  assert.strictEqual(steal.json.id, parent.id);
  const victim = db.getParents().find((p) => p.id === otherParent.id);
  assert.notStrictEqual(victim.studentNickname, '被篡改');
  console.log('✓ P0-02 parent cannot overwrite another profile');

  // P0-04 corrupt db.json
  const corruptPath = path.join(__dirname, 'data', 'db.corrupt-unit.json');
  fs.writeFileSync(corruptPath, '{not-json', 'utf8');
  const child = spawnSync(
    process.execPath,
    [
      '-e',
      `
      process.env.DATABASE_PATH = ${JSON.stringify(corruptPath)};
      try {
        require(${JSON.stringify(path.join(__dirname, 'src/db.js'))});
        process.exit(2);
      } catch (e) {
        const still = require('fs').readFileSync(${JSON.stringify(corruptPath)}, 'utf8');
        if (still !== '{not-json') process.exit(3);
        if (!e || e.code !== 'DB_CORRUPT') process.exit(4);
        process.exit(0);
      }
    `
    ],
    { encoding: 'utf8' }
  );
  assert.strictEqual(child.status, 0, 'corrupt db must fail loud without overwrite: ' + (child.stderr || child.stdout));
  const leftovers = fs.readdirSync(path.join(__dirname, 'data')).filter((n) => n.indexOf('db.corrupt-unit.json.corrupt.') === 0);
  leftovers.forEach((n) => fs.unlinkSync(path.join(__dirname, 'data', n)));
  fs.unlinkSync(corruptPath);
  console.log('✓ P0-04 parse error keeps original file and throws');

  // P1-01 magic + ACL
  const pdfBuf = Buffer.from('%PDF-1.4 security-acl');
  const saved = proofUpload.saveProofUpload(
    { buffer: pdfBuf, originalname: 'id.pdf', mimetype: 'application/pdf', size: pdfBuf.length },
    { tag: '身份证', originalName: 'id.pdf' },
    { userId: mentor.id, role: 'mentor' }
  );
  assert(saved.ok, saved.error);
  const anon = await fetch(base + saved.record.url);
  assert.strictEqual(anon.status, 401, 'anonymous proof GET denied');
  const parentGet = await fetch(base + saved.record.url, {
    headers: { Authorization: 'Bearer ' + parentToken }
  });
  assert.strictEqual(parentGet.status, 403, 'parent cannot download proofs');
  const mentorGet = await fetch(base + saved.record.url, {
    headers: { Authorization: 'Bearer ' + mentorToken }
  });
  assert.strictEqual(mentorGet.status, 200, 'owner mentor can download');
  assert.ok(mentorGet.headers.get('x-content-type-options') === 'nosniff');
  const adminGet = await fetch(base + saved.record.url, {
    headers: { Authorization: 'Bearer ' + adminToken }
  });
  assert.strictEqual(adminGet.status, 200, 'admin can download');
  try {
    fs.unlinkSync(path.join(proofUpload.PROOF_DIR, saved.record.id));
    fs.unlinkSync(path.join(proofUpload.PROOF_DIR, saved.record.id + '.meta.json'));
  } catch (_) {}
  console.log('✓ P1-01 proof ACL + nosniff');

  // P1-02 requireAdminToken
  const noTok = await request(base, 'POST', '/api/reset', {});
  assert.ok(noTok.status === 403 || noTok.status === 401);
  const bearerWrongCase = await request(base, 'GET', '/api/snapshot', null, null, {
    Authorization: 'bearer ' + process.env.ADMIN_TOKEN
  });
  assert.strictEqual(bearerWrongCase.status, 200, 'case-insensitive Bearer works for ADMIN_TOKEN');
  const staticOk = await request(base, 'GET', '/api/snapshot', null, null, {
    'X-Admin-Token': process.env.ADMIN_TOKEN
  });
  assert.strictEqual(staticOk.status, 200);
  assert.ok(auth.safeCompare('abc', 'abc'));
  assert.ok(!auth.safeCompare('abc', 'abd'));
  assert.ok(!auth.safeCompare('abc', 'ab'));
  console.log('✓ P1-02 admin token compare + no anonymous reset');

  // P1-03 concurrent phone lock
  sms.resetRateLimitsForTests();
  const p = '13980880001';
  const inflight = sms.sendSMS(p, 'login', auth, '203.0.113.10');
  const raced = await sms.sendSMS(p, 'login', auth, '203.0.113.10');
  assert.strictEqual(raced.success, false);
  assert.ok(/发送中/.test(raced.error || ''));
  await inflight;
  console.log('✓ P1-03 per-phone send lock');

  process.env.NODE_ENV = 'production';
  process.env.SMS_PROVIDER = 'tencent';
  delete require.cache[require.resolve('./src/sms')];
  const prodSms = require('./src/sms');
  const tencentFail = await prodSms.sendSMS('13980880002', 'login', auth, '203.0.113.9');
  assert.strictEqual(tencentFail.success, false, 'production tencent must not mock-fallback');
  process.env.NODE_ENV = 'development';
  process.env.SMS_PROVIDER = 'mock';
  delete require.cache[require.resolve('./src/sms')];
  console.log('✓ P1-03 production tencent does not silent-mock');

  // P1-04 refund_failed / pending
  const failOrder = db.savePayOrder({
    outTradeNo: 'BK-REFUND-FAIL-1',
    bookingId: booking.id,
    amount: 100,
    status: 'SUCCESS',
    mock: true
  });
  const failed = db.refundPayOrder(failOrder.outTradeNo, { status: 'ABNORMAL', reason: 'test' });
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(db.getPayOrder(failOrder.outTradeNo).status, 'refund_failed');
  const pendingOrder = db.savePayOrder({
    outTradeNo: 'BK-REFUND-PEND-1',
    bookingId: booking.id,
    amount: 100,
    status: 'SUCCESS',
    mock: true
  });
  const pending = db.refundPayOrder(pendingOrder.outTradeNo, { wxStatus: 'PROCESSING', reason: 'test' });
  assert.ok(pending.ok);
  assert.strictEqual(db.getPayOrder(pendingOrder.outTradeNo).status, 'refund_pending');
  const pendingAgain = db.refundPayOrder(pendingOrder.outTradeNo, { wxStatus: 'SUCCESS' });
  assert.strictEqual(pendingAgain.ok, false);
  console.log('✓ P1-04 refund_pending / refund_failed');

  // P1-06 parent cannot approve leave
  const leaveSess = Object.assign({}, sessionFar(), { id: (booking.sessions[0] && booking.sessions[0].id) || 'S1' });
  db.updateBooking(
    booking.id,
    { sessions: [Object.assign({}, leaveSess, { status: 'leave_pending' })], status: 'accepted' },
    { trust: 'admin' }
  );
  const parentApprove = await request(
    base,
    'POST',
    '/api/bookings/' + booking.id + '/leave',
    { sessionId: leaveSess.id, action: 'approve' },
    parentToken
  );
  assert.strictEqual(parentApprove.status, 403);
  const mentorApprove = await request(
    base,
    'POST',
    '/api/bookings/' + booking.id + '/leave',
    { sessionId: leaveSess.id, action: 'approve' },
    mentorToken
  );
  assert.strictEqual(mentorApprove.status, 200);
  console.log('✓ P1-06 leave approve requires mentor/admin');

  console.log('=== P0/P1 security tests passed ===');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
