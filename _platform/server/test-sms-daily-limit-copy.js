#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const https = require('https');

const DAILY_LIMIT_COPY = '该手机号今天验证码次数已用完，请明天再试，或更换号码。';
const TENCENT_DAILY_LIMIT_TEXT =
  'the number of sms messages sent from a single mobile number every day exceeds the upper limit';
const GENERIC_COPY = '短信发送失败，请稍后重试';

function loadSms() {
  process.env.NODE_ENV = 'production';
  process.env.SMS_PROVIDER = 'tencent';
  process.env.SMS_COOLDOWN_MS = '0';
  process.env.TENCENT_SMS_SECRET_ID = 'test-id';
  process.env.TENCENT_SMS_SECRET_KEY = 'test-key';
  process.env.TENCENT_SMS_SDK_APP_ID = '1400000000';
  process.env.TENCENT_SMS_TEMPLATE_LOGIN = '2753310';
  process.env.TENCENT_SMS_SIGN_NAME = '测试签名';
  delete require.cache[require.resolve('./src/sms')];
  return require('./src/sms');
}

function installHttpsResponse(payload) {
  const original = https.request;
  https.request = function (_options, callback) {
    const res = new EventEmitter();
    const req = new EventEmitter();
    req.write = function () {
      return true;
    };
    req.end = function () {
      process.nextTick(() => {
        if (typeof callback === 'function') callback(res);
        res.emit('data', JSON.stringify(payload));
        res.emit('end');
      });
    };
    return req;
  };
  return function restore() {
    https.request = original;
  };
}

async function sendWithPayload(sms, phone, scene, payload) {
  const restore = installHttpsResponse(payload);
  const logs = [];
  const originalError = console.error;
  console.error = function () {
    logs.push(Array.from(arguments).map(String).join(' '));
  };
  try {
    const result = await sms.sendSMS(phone, scene, null, '203.0.113.50');
    return { result, logs };
  } finally {
    console.error = originalError;
    restore();
  }
}

async function main() {
  const sms = loadSms();
  sms.resetRateLimitsForTests();

  const dailyPayload = {
    Response: {
      SendStatusSet: [
        {
          SerialNo: '',
          PhoneNumber: '+8613900000001',
          Code: 'LimitExceeded.PhoneNumberDailyLimit',
          Message: TENCENT_DAILY_LIMIT_TEXT
        }
      ]
    }
  };

  for (const scene of ['login', 'register', 'bind']) {
    const phone = scene === 'login' ? '13900000001' : scene === 'register' ? '13900000002' : '13900000003';
    const { result, logs } = await sendWithPayload(sms, phone, scene, dailyPayload);
    assert.strictEqual(result.success, false, scene);
    assert.strictEqual(result.error, DAILY_LIMIT_COPY, scene);
    assert.ok(
      logs.some((line) => line.includes(TENCENT_DAILY_LIMIT_TEXT)),
      'server log keeps the provider text for ' + scene
    );
    assert.ok(
      !logs.some((line) => line.includes(DAILY_LIMIT_COPY)),
      'client copy is not written to the server log for ' + scene
    );
  }

  const codeOnly = {
    Response: {
      SendStatusSet: [
        {
          Code: 'LimitExceeded.PhoneNumberDailyLimit',
          Message: '单个手机号日下发短信条数超过设定的上限'
        }
      ]
    }
  };
  const byCode = await sendWithPayload(sms, '13900000004', 'login', codeOnly);
  assert.strictEqual(byCode.result.error, DAILY_LIMIT_COPY);

  const hourly = {
    Response: {
      SendStatusSet: [
        {
          Code: 'LimitExceeded.PhoneNumberOneHourLimit',
          Message:
            'the number of sms messages sent from a single mobile number within one hour exceeds the upper limit'
        }
      ]
    }
  };
  const hourlyResult = await sendWithPayload(sms, '13900000005', 'login', hourly);
  assert.strictEqual(hourlyResult.result.success, false);
  assert.strictEqual(hourlyResult.result.error, GENERIC_COPY);
  assert.ok(hourlyResult.logs.some((line) => line.includes('within one hour')));

  const other = {
    Response: {
      Error: {
        Code: 'AuthFailure.SignatureFailure',
        Message: 'The provided credentials could not be validated.'
      }
    }
  };
  const otherResult = await sendWithPayload(sms, '13900000006', 'login', other);
  assert.strictEqual(otherResult.result.error, GENERIC_COPY);
  assert.ok(!String(otherResult.result.error).includes('credentials'));

  const okPayload = {
    Response: {
      SendStatusSet: [{ Code: 'Ok', Message: 'send success' }]
    }
  };
  const okResult = await sendWithPayload(sms, '13900000007', 'login', okPayload);
  assert.strictEqual(okResult.result.success, true);
  assert.strictEqual(okResult.result.provider, 'tencent');

  console.log('test-sms-daily-limit-copy: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
