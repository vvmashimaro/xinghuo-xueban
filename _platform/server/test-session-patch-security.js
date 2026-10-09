#!/usr/bin/env node
'use strict';

const http = require('http');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8787';
const PARENT_PHONE = '13980889211';
const MENTOR_PHONE = '13880123456';
const SMS_CODE = '888888';
const MENTOR_ID = 'AP-8802';

const SESSIONS = [
  {
    id: 'SES-SEC-1',
    date: '2031-02-05',
    weekday: 3,
    timeStart: '19:00',
    timeEnd: '21:00',
    timeLabel: '19:00-21:00',
    status: 'scheduled',
    escrowStatus: 'frozen'
  },
  {
    id: 'SES-SEC-2',
    date: '2031-02-12',
    weekday: 3,
    timeStart: '19:00',
    timeEnd: '21:00',
    timeLabel: '19:00-21:00',
    status: 'scheduled',
    escrowStatus: 'frozen'
  }
];

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
    throw new Error(`login failed for ${phone}: ${JSON.stringify(login.data)}`);
  }
  return login.data.token;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log('=== Session PATCH security tests ===');

  const parentToken = await login(PARENT_PHONE, 'parent');
  const mentorToken = await login(MENTOR_PHONE, 'mentor');

  const createRes = await request(
    'POST',
    '/api/bookings',
    {
      mentorId: MENTOR_ID,
      tutorId: MENTOR_ID,
      subject: '数学',
      space: '高新大源中央微网点',
      schedule: '周三 19:00-21:00',
      timeSlot: '周三 19:00-21:00',
      hours: 2,
      type: 'weekly',
      sessionCount: 2,
      sessions: SESSIONS
    },
    parentToken
  );
  assert(createRes.data && createRes.data.id, 'booking create failed');
  const bookingId = createRes.data.id;
  assert(
    Array.isArray(createRes.data.sessions) && createRes.data.sessions.length === 2,
    'expected 2 sessions on create'
  );
  const sessionId1 = createRes.data.sessions[0].id;
  const sessionId2 = createRes.data.sessions[1].id;
  assert(sessionId1 && sessionId1 !== 'SES-SEC-1', 'sessions must use server-generated ids');

  const prepayRes = await request(
    'POST',
    '/api/pay/wechat/prepay',
    { bookingId, description: 'session patch test' },
    parentToken
  );
  assert(prepayRes.data && prepayRes.data.prepayId, 'prepay failed');
  const confirmRes = await request(
    'POST',
    '/api/pay/wechat/mock-confirm',
    { outTradeNo: prepayRes.data.outTradeNo },
    parentToken
  );
  assert(confirmRes.data && confirmRes.data.success, 'mock confirm failed');
  console.log('✓ Paid booking with sessions ready');

  const acceptRes = await request(
    'POST',
    `/api/bookings/${bookingId}/respond`,
    { accept: true },
    mentorToken
  );
  assert(acceptRes.status === 200, 'mentor accept failed');

  const mentorHack = await request(
    'PATCH',
    `/api/bookings/${bookingId}`,
    {
      sessions: [
        {
          id: sessionId1,
          status: 'completed',
          completedAt: new Date().toISOString(),
          completedBy: 'mentor',
          releaseAt: '2020-01-01 00:00',
          escrowStatus: 'released'
        },
        {
          id: sessionId2,
          status: 'completed',
          releaseAt: '2020-01-01 00:00'
        }
      ],
      completedAt: new Date().toISOString()
    },
    mentorToken
  );
  assert(mentorHack.status === 200, `mentor patch status ${mentorHack.status}`);
  const s1 = mentorHack.data.sessions.find((s) => s.id === sessionId1);
  assert(s1 && s1.status === 'scheduled', `mentor cannot complete via PATCH, got ${s1 && s1.status}`);
  assert(!s1.releaseAt, 'mentor cannot set releaseAt via PATCH');
  console.log('✓ Mentor PATCH cannot mark sessions completed or set release');

  const parentHack = await request(
    'PATCH',
    `/api/bookings/${bookingId}`,
    {
      schedule: '周日 09:00-11:00',
      timeSlot: '周日 09:00-11:00',
      sessions: [
        {
          id: sessionId1,
          status: 'leave_approved',
          leaveConfirmedAt: new Date().toISOString(),
          date: '2099-01-01',
          timeStart: '09:00'
        },
        {
          id: 'SES-EXTRA',
          status: 'scheduled',
          date: '2099-02-01'
        }
      ]
    },
    parentToken
  );
  assert(parentHack.status === 200, `parent patch status ${parentHack.status}`);
  assert(
    parentHack.data.schedule === createRes.data.schedule,
    'parent cannot change schedule after payment'
  );
  assert(
    parentHack.data.sessions.length === 2,
    'parent cannot add sessions via PATCH'
  );
  const s1p = parentHack.data.sessions.find((s) => s.id === sessionId1);
  assert(s1p && s1p.status === 'scheduled', 'parent cannot confirm leave via PATCH');
  assert(s1p.date === '2031-02-05', 'parent cannot change session date via PATCH');
  console.log('✓ Parent PATCH cannot change schedule/sessions lifecycle after payment');

  const parentMsg = await request(
    'POST',
    `/api/bookings/${bookingId}/parent-message`,
    {
      sessionId: sessionId1,
      parentMessage: { content: '请多布置错题' }
    },
    parentToken
  );
  assert(parentMsg.status === 200 && parentMsg.data.ok, 'parent message route failed');
  const s1m = parentMsg.data.booking.sessions.find((s) => s.id === sessionId1);
  assert(
    s1m && s1m.parentMessage && s1m.parentMessage.content === '请多布置错题',
    'parentMessage should be saved via PATCH'
  );
  console.log('✓ Parent can POST parentMessage on existing session');

  const completeRes = await request(
    'POST',
    `/api/bookings/${bookingId}/complete`,
    {
      sessionId: sessionId1,
      completedBy: 'mentor',
      classSummary: { content: '本节课完成', title: '小结' }
    },
    mentorToken
  );
  assert(completeRes.status === 200 && completeRes.data.ok, 'complete route failed');
  const done = completeRes.data.booking.sessions.find((s) => s.id === sessionId1);
  assert(done && done.status === 'completed', 'complete route should mark session completed');
  assert(done && done.completedAt, 'complete route sets completedAt');
  console.log('✓ Dedicated complete route still works');

  console.log('=== Session PATCH security tests passed ===');
}

run().catch((err) => {
  console.error('✗', err.message || err);
  process.exit(1);
});
