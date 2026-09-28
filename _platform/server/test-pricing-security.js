#!/usr/bin/env node
'use strict';

/**
 * Server-side pricing authority: client tampered amounts must be ignored;
 * double payment rejected.
 */

const http = require('http');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8787';
const PARENT_PHONE = '13980889211';
const SMS_CODE = '888888';
const MENTOR_ID = 'AP-8802';
const OTHER_MENTOR_PHONE = '15928114422';
const EXPECTED_YUAN = 220;
const EXPECTED_FEN = 22000;

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

async function loginWithRole(phone, role) {
  const verify = await request('POST', '/api/auth/sms/verify', {
    phone,
    code: SMS_CODE,
    scene: 'login'
  });
  if (!verify.data || !verify.data.ticket) {
    throw new Error('SMS verify failed: ' + JSON.stringify(verify.data));
  }
  const login = await request('POST', '/api/auth/login', {
    ticket: verify.data.ticket,
    role
  });
  if (!login.data || !login.data.token) {
    throw new Error('Login failed: ' + JSON.stringify(login.data));
  }
  return login.data.token;
}

async function loginParent() {
  return loginWithRole(PARENT_PHONE, 'parent');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log('=== Pricing security tests ===');
  console.log('API:', API_BASE);

  const token = await loginParent();

  const bookingRes = await request(
    'POST',
    '/api/bookings',
    {
      mentorId: MENTOR_ID,
      tutorId: MENTOR_ID,
      tutorName: '测试导师',
      subject: '数学',
      space: '测试网点',
      schedule: '周六 14:00-16:00',
      timeSlot: '周六 14:00-16:00',
      amount: 0.01,
      total: 0.01,
      price: 1,
      hourlyRate: 1,
      hours: 2,
      type: 'one_off',
      status: 'accepted',
      paymentStatus: 'paid',
      id: 'BK-EVIL-CLIENT',
      paidAt: '2020-01-01T00:00:00.000Z',
      transactionId: 'FAKE-TX',
      escrowStatus: 'released',
      declineReason: 'hacked',
      summary: { hacked: true }
    },
    token
  );

  assert(
    bookingRes.status === 200 && bookingRes.data && bookingRes.data.id,
    `create booking failed: ${bookingRes.status} ${JSON.stringify(bookingRes.data)}`
  );
  assert(
    Number(bookingRes.data.amount) === EXPECTED_YUAN,
    `expected server amount ${EXPECTED_YUAN}, got ${bookingRes.data.amount}`
  );
  assert(
    bookingRes.data.paymentStatus === 'unpaid',
    `expected paymentStatus unpaid, got ${bookingRes.data.paymentStatus}`
  );
  assert(
    bookingRes.data.status === 'pending_accept',
    `expected status pending_accept, got ${bookingRes.data.status}`
  );
  assert(
    bookingRes.data.id !== 'BK-EVIL-CLIENT',
    'client must not set booking id'
  );
  console.log('✓ Tampered addBooking amount ignored (server amount:', bookingRes.data.amount, ')');
  console.log('✓ Client paymentStatus/status/id overrides rejected on create');

  const bookingId = bookingRes.data.id;

  const patchRes = await request(
    'PATCH',
    `/api/bookings/${bookingId}`,
    {
      paymentStatus: 'paid',
      amount: 0.01,
      escrowStatus: 'released',
      status: 'completed',
      hours: 99
    },
    token
  );
  assert(patchRes.status === 200 && patchRes.data, `patch failed: ${patchRes.status}`);
  assert(
    patchRes.data.paymentStatus === 'unpaid',
    `PATCH must not set paymentStatus, got ${patchRes.data.paymentStatus}`
  );
  assert(
    Number(patchRes.data.amount) === EXPECTED_YUAN,
    `PATCH must not change amount, got ${patchRes.data.amount}`
  );
  assert(
    patchRes.data.status === 'pending_accept',
    `PATCH must not set status, got ${patchRes.data.status}`
  );
  console.log('✓ Parent PATCH cannot set payment/amount/status');

  const otherMentorToken = await loginWithRole(OTHER_MENTOR_PHONE, 'mentor');
  const respondRes = await request(
    'POST',
    `/api/bookings/${bookingId}/respond`,
    { accept: true },
    otherMentorToken
  );
  assert(
    respondRes.status === 403,
    `other mentor respond should be 403, got ${respondRes.status}`
  );
  console.log('✓ Mentor cannot respond to another mentor booking');

  const prepayRes = await request(
    'POST',
    '/api/pay/wechat/prepay',
    {
      bookingId,
      amount: 1,
      description: 'tamper test'
    },
    token
  );

  assert(
    prepayRes.status === 200 && prepayRes.data && prepayRes.data.prepayId,
    `prepay failed: ${prepayRes.status} ${JSON.stringify(prepayRes.data)}`
  );
  assert(
    Number(prepayRes.data.amountFen) === EXPECTED_FEN,
    `expected amountFen ${EXPECTED_FEN}, got ${prepayRes.data.amountFen}`
  );
  console.log('✓ Tampered prepay amount ignored (amountFen:', prepayRes.data.amountFen, ')');

  const outTradeNo = prepayRes.data.outTradeNo;
  assert(outTradeNo, 'missing outTradeNo');

  const confirmRes = await request(
    'POST',
    '/api/pay/wechat/mock-confirm',
    { outTradeNo },
    token
  );
  assert(
    confirmRes.status === 200 && confirmRes.data && confirmRes.data.success,
    `mock confirm failed: ${confirmRes.status} ${JSON.stringify(confirmRes.data)}`
  );
  console.log('✓ Mock confirm succeeded');

  const prepayAgain = await request(
    'POST',
    '/api/pay/wechat/prepay',
    { bookingId, amount: 1 },
    token
  );
  assert(
    prepayAgain.status === 400,
    `double prepay should be 400, got ${prepayAgain.status}`
  );
  console.log('✓ Double prepay rejected:', prepayAgain.data.error || prepayAgain.data);

  const confirmAgain = await request(
    'POST',
    '/api/pay/wechat/mock-confirm',
    { outTradeNo },
    token
  );
  assert(
    confirmAgain.status === 400,
    `double mock confirm should be 400, got ${confirmAgain.status}`
  );
  console.log('✓ Double mock confirm rejected');

  console.log('=== Pricing security tests passed ===');
}

run().catch((err) => {
  console.error('✗', err.message || err);
  process.exit(1);
});
