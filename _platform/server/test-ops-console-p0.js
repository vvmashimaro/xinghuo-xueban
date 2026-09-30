/**
 * P0 ops console API smoke tests (no admin mock login required)
 */
'use strict';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8787';
const MENTOR_PHONE = '18628009821';

async function request(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function loginMentor() {
  const verify = await request('POST', '/api/auth/sms/verify', {
    phone: MENTOR_PHONE,
    code: '888888',
    scene: 'login'
  });
  if (!verify.json.ticket) throw new Error('mentor verify failed');
  const login = await request('POST', '/api/auth/login', { ticket: verify.json.ticket, role: 'mentor' });
  if (!login.json.token) throw new Error('mentor login failed');
  return login.json.token;
}

async function main() {
  const pubFlags = await request('GET', '/api/feature-flags');
  if (pubFlags.status !== 200 || pubFlags.json.FEATURE_SMART_WAREHOUSE == null) {
    throw new Error('public feature flags failed');
  }

  const token = await loginMentor();
  const fb = await request(
    'POST',
    '/api/feedback',
    { title: 'smoke', detail: 'ops console api', type: '功能问题' },
    token
  );
  if (fb.status !== 200 || !fb.json.id) throw new Error('feedback create failed');

  const denied = await request('GET', '/api/pay/orders', null, token);
  if (denied.status !== 403) throw new Error('pay orders should be admin-only');

  const pause = await request('PATCH', '/api/mentors/AP-8801', { acceptingOrders: false }, token);
  if (pause.status !== 403 && pause.status !== 200) {
    throw new Error('unexpected mentor patch status ' + pause.status);
  }

  console.log('test-ops-console-p0: OK');
}

main().catch((e) => {
  console.error('test-ops-console-p0: FAIL', e.message);
  process.exit(1);
});
