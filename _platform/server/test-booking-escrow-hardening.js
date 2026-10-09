#!/usr/bin/env node
'use strict';

const http = require('http');
const bookingFields = require('./src/booking-fields');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8787';
const PARENT_PHONE = '13980889211';
const MENTOR_PHONE = '13880123456';
const SMS_CODE = '888888';
const MENTOR_ID = 'AP-8802';

function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers.Authorization = `Bearer ${token}`;

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (_) {
          parsed = { error: body };
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login(phone, role) {
  const verify = await request('POST', '/api/auth/sms/verify', {
    phone,
    code: SMS_CODE,
    scene: 'login'
  });
  const login = await request('POST', '/api/auth/login', {
    ticket: verify.data.ticket,
    role
  });
  if (!login.data || !login.data.token) {
    throw new Error(`login failed: ${JSON.stringify(login.data)}`);
  }
  return login.data.token;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log('=== Booking escrow hardening tests ===');

  assert(
    !bookingFields.bookingEscrowReleaseAllowed({ paymentStatus: 'unpaid' }),
    'unpaid booking must not allow escrow release'
  );
  assert(
    bookingFields.bookingEscrowReleaseAllowed({ paymentStatus: 'paid' }),
    'paid booking allows escrow release check'
  );
  console.log('✓ Escrow release gated on paymentStatus=paid');

  const parentToken = await login(PARENT_PHONE, 'parent');
  const mentorToken = await login(MENTOR_PHONE, 'mentor');

  const evilSessions = [
    {
      id: 'SES-EVIL',
      date: '2031-01-08',
      weekday: 3,
      timeStart: '19:00',
      timeEnd: '21:00',
      timeLabel: '19:00-21:00',
      status: 'completed',
      completedAt: '2020-01-01T00:00:00.000Z',
      releaseAt: '2020-01-01 00:00',
      escrowStatus: 'released',
      amount: 0.01
    }
  ];

  const createRes = await request(
    'POST',
    '/api/bookings',
    {
      mentorId: MENTOR_ID,
      subject: '数学',
      space: '高新大源中央微网点',
      schedule: '周三 19:00-21:00',
      hours: 2,
      type: 'weekly',
      sessionCount: 1,
      sessions: evilSessions
    },
    parentToken
  );
  assert(createRes.data && createRes.data.id, 'create failed');
  const bookingId = createRes.data.id;
  const sess = createRes.data.sessions[0];
  assert(sess && sess.status === 'scheduled', `expected scheduled, got ${sess && sess.status}`);
  assert(sess && !sess.releaseAt, 'client releaseAt must be stripped');
  assert(sess && sess.escrowStatus === 'frozen', 'session escrow must be server frozen');
  assert(sess.id !== 'SES-EVIL', 'client session id must be replaced');
  console.log('✓ Create rebuilds sessions without client lifecycle fields');

  const completeUnpaid = await request(
    'POST',
    `/api/bookings/${bookingId}/complete`,
    { sessionId: sess.id },
    mentorToken
  );
  assert(completeUnpaid.status === 400, 'complete on unpaid must fail');
  console.log('✓ Complete rejected when unpaid / not accepted');

  const acceptRes = await request(
    'POST',
    `/api/bookings/${bookingId}/respond`,
    { accept: true },
    mentorToken
  );
  assert(acceptRes.status === 200, 'accept failed');

  const completeUnpaid2 = await request(
    'POST',
    `/api/bookings/${bookingId}/complete`,
    { sessionId: sess.id },
    mentorToken
  );
  assert(completeUnpaid2.status === 400, 'complete still blocked without payment');
  console.log('✓ Complete rejected after accept without payment');

  const prepayRes = await request(
    'POST',
    '/api/pay/wechat/prepay',
    { bookingId },
    parentToken
  );
  const confirmRes = await request(
    'POST',
    '/api/pay/wechat/mock-confirm',
    { outTradeNo: prepayRes.data.outTradeNo },
    parentToken
  );
  assert(confirmRes.data && confirmRes.data.success, 'pay failed');

  const contractRes = await request(
    'POST',
    '/api/contracts',
    {
      bookingId,
      signer: '刘女士',
      amount: 0.01,
      tutorName: '假导师',
      space: '假网点'
    },
    parentToken
  );
  assert(contractRes.status === 200 && contractRes.data, 'contract failed');
  assert(
    Number(contractRes.data.amount) === Number(createRes.data.amount),
    `contract amount must match booking, got ${contractRes.data.amount}`
  );
  assert(contractRes.data.space === createRes.data.space, 'contract space from booking');
  console.log('✓ Contract uses server booking amount and space');

  const msgRes = await request(
    'POST',
    `/api/bookings/${bookingId}/parent-message`,
    {
      sessionId: sess.id,
      parentMessage: { content: '课后请复盘' }
    },
    parentToken
  );
  assert(msgRes.status === 200 && msgRes.data.ok, 'parent-message route failed');
  const msgSess = msgRes.data.booking.sessions.find((s) => s.id === sess.id);
  assert(
    msgSess && msgSess.parentMessage && msgSess.parentMessage.content === '课后请复盘',
    'parent message stored'
  );
  console.log('✓ Parent-message route persists session message');

  const completePaid = await request(
    'POST',
    `/api/bookings/${bookingId}/complete`,
    { sessionId: sess.id, classSummary: { content: '完成' } },
    mentorToken
  );
  assert(completePaid.status === 200 && completePaid.data.ok, 'complete after pay failed');
  const done = completePaid.data.booking.sessions.find((s) => s.id === sess.id);
  assert(done && done.status === 'completed' && done.releaseAt, 'server sets releaseAt on complete');
  console.log('✓ Complete works when paid and accepted');

  console.log('=== Booking escrow hardening tests passed ===');
}

run().catch((err) => {
  console.error('✗', err.message || err);
  process.exit(1);
});
