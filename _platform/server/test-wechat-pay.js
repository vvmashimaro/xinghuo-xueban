#!/usr/bin/env node
/**
 * 微信支付模块单元测试（无需真实商户密钥）
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const wechatPay = require('./src/wechat-pay');

function genAesGcmPayload(plaintext, apiV3Key, associatedData, nonce) {
  const key = Buffer.from(apiV3Key, 'utf8');
  const iv = Buffer.from(nonce, 'utf8');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (associatedData) cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([enc, tag]).toString('base64');
}

async function run() {
  const savedEnv = { ...process.env };
  process.env = Object.assign({}, process.env);
  delete process.env.WECHAT_MCH_ID;
  delete process.env.WECHAT_API_V3_KEY;
  delete process.env.WECHAT_NOTIFY_URL;

  assert.strictEqual(wechatPay.isConfigComplete(), false);
  const mockPrepay = await wechatPay.createPrepay({
    bookingId: 'BK-TEST-001',
    amount: 100,
    description: 'unit test'
  });
  assert.strictEqual(mockPrepay.mock, true);
  assert.ok(mockPrepay.prepayId);
  assert.ok(mockPrepay.outTradeNo);

  wechatPay.mockConfirmPayment(mockPrepay.outTradeNo);
  const mockRefund = await wechatPay.refundOrder({
    outTradeNo: mockPrepay.outTradeNo,
    reason: 'unit test refund',
    amountFen: 100
  });
  assert.strictEqual(mockRefund.success, true);
  assert.strictEqual(mockRefund.mock, true);

  const apiKey = '12345678901234567890123456789012';
  const nonce = 'test-nonce-12';
  const resourceBody = JSON.stringify({
    out_trade_no: 'BK-TEST-001-123',
    transaction_id: 'wx-tx-1',
    trade_state: 'SUCCESS',
    success_time: '2026-01-01T00:00:00+08:00',
    amount: { total: 100 }
  });
  const ciphertext = genAesGcmPayload(resourceBody, apiKey, 'transaction', nonce);
  process.env.WECHAT_API_V3_KEY = apiKey;

  const decrypted = wechatPay.decryptNotifyResource({
    ciphertext,
    associated_data: 'transaction',
    nonce
  });
  assert.strictEqual(decrypted.trade_state, 'SUCCESS');
  assert.strictEqual(decrypted.out_trade_no, 'BK-TEST-001-123');

  const notifyBody = {
    id: 'EV-1',
    event_type: 'TRANSACTION.SUCCESS',
    resource: { ciphertext, associated_data: 'transaction', nonce, algorithm: 'AEAD_AES_256_GCM' }
  };
  const notifyResult = await wechatPay.handlePaymentNotify(notifyBody, {}, JSON.stringify(notifyBody));
  assert.strictEqual(notifyResult.tradeState, 'SUCCESS');

  const pemPlain = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
  const pemCipher = genAesGcmPayload(pemPlain, apiKey, 'certificate', nonce);
  const pemDecoded = wechatPay.decryptAes256GcmRaw({
    ciphertext: pemCipher,
    associated_data: 'certificate',
    nonce
  }, apiKey);
  assert.strictEqual(pemDecoded, pemPlain);
  assert.ok(wechatPay.parsePlatformCertPem(pemDecoded).indexOf('BEGIN CERTIFICATE') >= 0);

  assert.strictEqual(wechatPay.interpretRefundStatus({ status: 'PROCESSING' }).success, true);
  assert.strictEqual(wechatPay.interpretRefundStatus({ status: 'SUCCESS' }).success, true);
  assert.strictEqual(wechatPay.interpretRefundStatus({ status: 'ABNORMAL' }).success, false);
  assert.strictEqual(wechatPay.interpretRefundStatus({ status: 'CLOSED' }).success, false);

  const savedNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let threw = false;
  try {
    await wechatPay.handlePaymentNotify({ out_trade_no: 'BK-FORGED', trade_state: 'SUCCESS' }, {}, '{}');
  } catch (err) {
    threw = /配置不完整|拒绝处理/.test(String(err && err.message));
  }
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNodeEnv;
  assert.ok(threw, 'production must reject notify when WeChat Pay config is incomplete');

  assert.strictEqual(
    wechatPay.parseBookingIdFromOutTradeNo('BK-BK-MUNG8VXL-270-1790733090731'),
    'BK-MUNG8VXL-270'
  );
  assert.strictEqual(
    wechatPay.parseBookingIdFromOutTradeNo('BK-BK-SEED-001-1234567890123'),
    'BK-SEED-001'
  );

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' });
  process.env.WECHAT_PRIVATE_KEY_PEM = pem.toString().replace(/\n/g, '\\n');
  const sig = wechatPay.generateSignature('POST', '/v3/pay/transactions/jsapi', '1600000000', 'NONCE', '{}');
  assert.ok(sig.length > 20);
  const okVerify = crypto.createVerify('RSA-SHA256').update('POST\n/v3/pay/transactions/jsapi\n1600000000\nNONCE\n{}\n').verify(publicKey, sig, 'base64');
  assert.strictEqual(okVerify, true);

  process.env = savedEnv;
  console.log('test-wechat-pay: OK');
}

run().catch((err) => {
  console.error('test-wechat-pay: FAIL', err);
  process.exit(1);
});
