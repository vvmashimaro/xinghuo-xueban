#!/usr/bin/env node
'use strict';

const assert = require('assert');

function loadSmsWithEnv(env) {
  const keys = ['ALLOW_DEV_OTP', 'DEV_OTP_CODE', 'NODE_ENV'];
  const saved = {};
  for (const k of keys) {
    saved[k] = process.env[k];
  }
  Object.assign(process.env, env);
  delete require.cache[require.resolve('./src/sms')];
  delete require.cache[require.resolve('./src/auth')];
  const sms = require('./src/sms');
  const auth = require('./src/auth');
  return {
    sms,
    auth,
    restore() {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      delete require.cache[require.resolve('./src/sms')];
      delete require.cache[require.resolve('./src/auth')];
    }
  };
}

function run() {
  const adminPhone = '13540012341';

  {
    const ctx = loadSmsWithEnv({ NODE_ENV: 'production', ALLOW_DEV_OTP: undefined });
    const r = ctx.sms.verifySMS('13980889211', '888888', 'login', ctx.auth);
    assert.strictEqual(r.success, false);
    ctx.restore();
  }

  {
    const ctx = loadSmsWithEnv({ NODE_ENV: 'production', ALLOW_DEV_OTP: 'true' });
    assert.strictEqual(ctx.sms.isDevOtpEnabled(), true);
    const user = ctx.sms.verifySMS('13980889211', '888888', 'login', ctx.auth);
    assert.strictEqual(user.success, true);
    assert.ok(user.ticket);
    const admin = ctx.sms.verifySMS(adminPhone, '888888', 'login', ctx.auth);
    assert.strictEqual(admin.success, false, 'production must reject DEV OTP for admin');
    assert.ok(admin.error);
    ctx.restore();
  }

  {
    const ctx = loadSmsWithEnv({ NODE_ENV: 'development', ALLOW_DEV_OTP: 'true' });
    const admin = ctx.sms.verifySMS(adminPhone, '888888', 'login', ctx.auth);
    assert.strictEqual(admin.success, true, 'non-production admin may use DEV OTP');
    ctx.restore();
  }

  {
    const ctx = loadSmsWithEnv({
      NODE_ENV: 'production',
      ALLOW_DEV_OTP: 'true',
      DEV_OTP_CODE: '121212'
    });
    const bad = ctx.sms.verifySMS('13980889211', '888888', 'login', ctx.auth);
    assert.strictEqual(bad.success, false);
    const ok = ctx.sms.verifySMS('13980889211', '121212', 'bind', ctx.auth);
    assert.strictEqual(ok.success, true);
    ctx.restore();
  }

  console.log('test-dev-otp: OK');
}

run();
process.exit(0);
