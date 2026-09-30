/**
 * P0 ops console API smoke + security tests.
 * Boots an embedded API on :18787 unless API_BASE is set (external server skips admin-token cases).
 */
'use strict';

const MENTOR_PHONE = '18628009821';
const PARENT_PHONE = '13980889211';
const MENTOR_ID = 'AP-8801';

let apiBase = process.env.API_BASE || '';
let embedded = false;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureApi() {
  if (apiBase) return apiBase;
  process.env.PORT = '18787';
  process.env.HOST = '127.0.0.1';
  require('./src/index.js');
  embedded = true;
  apiBase = 'http://127.0.0.1:18787';
  await sleep(1200);
  return apiBase;
}

async function request(method, path, body, token) {
  const base = await ensureApi();
  const res = await fetch(base + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function loginRole(phone, role) {
  const verify = await request('POST', '/api/auth/sms/verify', { phone, code: '888888', scene: 'login' });
  if (!verify.json.ticket) throw new Error(role + ' verify failed');
  const login = await request('POST', '/api/auth/login', { ticket: verify.json.ticket, role });
  if (!login.json.token) throw new Error(role + ' login failed');
  return login.json.token;
}

function adminToken() {
  if (!embedded) return null;
  const db = require('./src/db');
  const auth = require('./src/auth');
  return auth.createToken('ADMIN-test', 'admin', '13540012341', db);
}

async function main() {
  const pubFlags = await request('GET', '/api/feature-flags');
  if (pubFlags.status !== 200 || pubFlags.json.FEATURE_SMART_WAREHOUSE == null) {
    throw new Error('public feature flags failed');
  }

  const mentorToken = await loginRole(MENTOR_PHONE, 'mentor');
  const parentToken = await loginRole(PARENT_PHONE, 'parent');

  const fb = await request(
    'POST',
    '/api/feedback',
    { title: 'smoke', detail: 'ops console api', type: '功能问题' },
    mentorToken
  );
  if (fb.status !== 200 || !fb.json.id) throw new Error('feedback create failed');

  const inject = await request(
    'POST',
    '/api/feedback',
    {
      title: 'inject',
      detail: 'evil',
      status: '已解决',
      handledBy: 'attacker',
      handledAt: '2099-01-01',
      handlerNote: 'self-approved',
      mentorId: MENTOR_ID
    },
    parentToken
  );
  if (inject.status !== 200) throw new Error('parent feedback create failed');
  if (inject.json.status !== '待处理') throw new Error('feedback must force status 待处理 on create');
  if (inject.json.handledBy) throw new Error('feedback must not accept handledBy on create');
  if (inject.json.mentorId) throw new Error('parent must not set mentorId on create');

  const mentorList = await request('GET', '/api/feedback', null, mentorToken);
  const leaked = (mentorList.json || []).some((t) => t.id === inject.json.id);
  if (leaked) throw new Error('injected parent ticket leaked into mentor list');

  const denied = await request('GET', '/api/pay/orders', null, mentorToken);
  if (denied.status !== 403) throw new Error('pay orders should be admin-only');

  await request('PATCH', '/api/mentors/' + MENTOR_ID, { acceptingOrders: false }, mentorToken);
  const bookBlocked = await request(
    'POST',
    '/api/bookings',
    {
      mentorId: MENTOR_ID,
      subject: '初中数学',
      space: '青羊金沙文化微网点',
      schedule: '周六 14:00-16:00',
      timeSlot: '周六 14:00-16:00'
    },
    parentToken
  );
  if (bookBlocked.status !== 400) throw new Error('booking against paused mentor should fail');
  if (!String(bookBlocked.json.error || '').includes('暂不接收')) {
    throw new Error('expected paused-mentor error, got: ' + bookBlocked.json.error);
  }
  await request('PATCH', '/api/mentors/' + MENTOR_ID, { acceptingOrders: true }, mentorToken);

  const adminTok = adminToken();
  if (!adminTok) {
    console.log('test-ops-console-p0: OK (refund cases skipped — set API_BASE unset for full suite)');
    return;
  }

  const bookingRes = await request(
    'POST',
    '/api/bookings',
    {
      mentorId: 'AP-8802',
      subject: '初中物理',
      space: '青羊金沙文化微网点',
      schedule: '周日 09:00-11:00',
      timeSlot: '周日 09:00-11:00'
    },
    parentToken
  );
  if (!bookingRes.json.id) throw new Error('booking create for refund test failed');
  const bookingId = bookingRes.json.id;

  const prepay = await request(
    'POST',
    '/api/pay/wechat/prepay',
    { bookingId, description: 'test' },
    parentToken
  );
  if (!prepay.json.outTradeNo) throw new Error('prepay failed');
  const outTradeNo = prepay.json.outTradeNo;

  const confirm = await request('POST', '/api/pay/wechat/mock-confirm', { outTradeNo }, parentToken);
  if (!confirm.json.success) throw new Error('mock confirm failed');

  const refundUnpaid = await request(
    'POST',
    '/api/pay/orders/XH-NOTPAID-000/refund',
    {},
    adminTok
  );
  if (refundUnpaid.status !== 404 && refundUnpaid.status !== 400) {
    throw new Error('refund missing order should 404/400');
  }

  const refund1 = await request(
    'POST',
    '/api/pay/orders/' + encodeURIComponent(outTradeNo) + '/refund',
    { reason: 'test' },
    adminTok
  );
  if (refund1.status !== 200 || !refund1.json.ok) throw new Error('first refund failed');

  const refund2 = await request(
    'POST',
    '/api/pay/orders/' + encodeURIComponent(outTradeNo) + '/refund',
    { reason: 'double' },
    adminTok
  );
  if (refund2.status !== 400) throw new Error('double refund must be rejected');

  console.log('test-ops-console-p0: OK');
  if (embedded) process.exit(0);
}

main().catch((e) => {
  console.error('test-ops-console-p0: FAIL', e.message);
  process.exit(1);
});
