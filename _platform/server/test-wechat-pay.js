#!/usr/bin/env node
/**
 * 微信支付模块单元测试（无需真实商户密钥）
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
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
  wechatPay.markOrderPaid(mockPrepay.outTradeNo, {
    transactionId: 'MOCK-MARK-1',
    successTime: '2026-10-22T10:50:54+08:00'
  });
  const marked = wechatPay.getLocalOrderStatus(mockPrepay.outTradeNo);
  assert.strictEqual(marked.status, 'SUCCESS');
  assert.strictEqual(marked.transactionId, 'MOCK-MARK-1');

  const mockRefund = await wechatPay.refundOrder({
    outTradeNo: mockPrepay.outTradeNo,
    reason: 'unit test refund',
    amountFen: 100
  });
  assert.strictEqual(mockRefund.success, true);
  assert.strictEqual(mockRefund.mock, true);

  const unpaidMock = await wechatPay.createPrepay({
    bookingId: 'BK-UNPAID-MOCK',
    amount: 11000,
    description: 'unpaid mock refund'
  });
  const unpaidRefund = await wechatPay.refundOrder({
    outTradeNo: unpaidMock.outTradeNo,
    reason: 'should reject unpaid mock',
    amountFen: 11000
  });
  assert.strictEqual(unpaidRefund.success, false);
  assert.strictEqual(unpaidRefund.error, '订单未支付，无法退款');

  wechatPay.registerMockOrder({
    outTradeNo: 'BK-REAL-SHOULD-NOT-LEDGER',
    status: 'NOTPAY',
    mock: false,
    amount: 11000
  });
  assert.strictEqual(wechatPay.getLocalOrderStatus('BK-REAL-SHOULD-NOT-LEDGER'), null);

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

  // —— User-Agent：预支付 / 退款 / 证书 / 查单走同一套请求头 ——
  assert.strictEqual(wechatPay.WECHAT_PAY_USER_AGENT, 'XinghuoXueban-Server/1.0');
  const headerPreview = wechatPay.buildWechatPayHeaders('WECHATPAY2-TEST', '{"a":1}');
  assert.strictEqual(headerPreview['User-Agent'], 'XinghuoXueban-Server/1.0');
  assert.strictEqual(headerPreview.Accept, 'application/json');

  process.env.WECHAT_MCH_ID = '1230000000';
  process.env.WECHAT_APP_ID = 'wx-unit-test';
  process.env.WECHAT_API_V3_KEY = apiKey;
  process.env.WECHAT_MCH_SERIAL_NO = 'MCHSERIALUNITTEST';
  process.env.WECHAT_NOTIFY_URL = 'https://example.com/api/pay/wechat/notify';

  const fetchCalls = [];
  wechatPay.setWechatPayFetch(async (url, init) => {
    fetchCalls.push({ url, init });
    const pathName = String(url).replace(/^https:\/\/api\.mch\.weixin\.qq.com/, '');
    let payload = {};
    if (pathName.indexOf('/v3/refund/domestic/refunds') === 0) {
      payload = { status: 'PROCESSING', refund_id: 'RF-MOCK-1', out_refund_no: 'RF-1' };
    } else if (pathName.indexOf('/v3/pay/transactions/jsapi') === 0) {
      payload = { prepay_id: 'wx-prepay-mock' };
    } else if (pathName.indexOf('/v3/pay/transactions/native') === 0) {
      payload = { code_url: 'weixin://wxpay/bizpayurl/mock' };
    } else if (pathName.indexOf('/v3/certificates') === 0) {
      payload = { data: [] };
    } else if (pathName.indexOf('/v3/pay/transactions/out-trade-no/') === 0) {
      payload = { out_trade_no: 'BK-Q-1', trade_state: 'NOTPAY' };
    }
    return { status: 200, text: async () => JSON.stringify(payload) };
  });

  await wechatPay.wechatPayRequest('GET', '/v3/certificates');
  const jsapi = await wechatPay.createPrepay({
    bookingId: 'BK-UA-JSAPI',
    amount: 100,
    description: 'ua test',
    openid: 'o-test',
    payType: 'JSAPI'
  });
  assert.strictEqual(jsapi.mock, false);
  assert.strictEqual(jsapi.prepayId, 'wx-prepay-mock');

  const refundLive = await wechatPay.refundOrder({
    outTradeNo: 'BK-UA-LIVE-1',
    reason: 'ua refund',
    amountFen: 100
  });
  assert.strictEqual(refundLive.success, true);
  assert.strictEqual(refundLive.mock, false);

  // 生产事故复现：真实预下单曾写入 mockOrders=NOTPAY，回调只写 DB SUCCESS。
  // ALLOW_MOCK_PAY=false 时不得再信内存 NOTPAY，必须打到微信退款 API。
  const savedAllowMock = process.env.ALLOW_MOCK_PAY;
  const savedProdEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_MOCK_PAY;
  wechatPay.registerMockOrder({
    outTradeNo: 'BK-BK-MVIY1SS1-858-1792637444636',
    bookingId: 'BK-MVIY1SS1-858',
    status: 'NOTPAY',
    mock: false,
    amount: 11000
  }, { force: true });
  const staleQuery = await wechatPay.queryTransactionByOutTradeNo('BK-BK-MVIY1SS1-858-1792637444636');
  assert.strictEqual(staleQuery.mock, false, 'stale real NOTPAY must not win over WeChat query');

  const refundCallsBefore = fetchCalls.filter((c) => String(c.url).indexOf('/v3/refund/domestic/refunds') >= 0).length;
  const staleRefund = await wechatPay.refundOrder({
    outTradeNo: 'BK-BK-MVIY1SS1-858-1792637444636',
    reason: '家长开课前撤销',
    amountFen: 11000,
    transactionId: '4500000542202610228104943666'
  });
  assert.strictEqual(staleRefund.success, true, staleRefund.error || 'stale NOTPAY must not block real refund');
  assert.strictEqual(staleRefund.mock, false);
  const refundCallsAfter = fetchCalls.filter((c) => String(c.url).indexOf('/v3/refund/domestic/refunds') >= 0).length;
  assert.strictEqual(refundCallsAfter, refundCallsBefore + 1, 'real SUCCESS refund must call WeChat refund API');
  const lastRefund = fetchCalls.filter((c) => String(c.url).indexOf('/v3/refund/domestic/refunds') >= 0).pop();
  const lastRefundBody = JSON.parse(lastRefund.init.body);
  assert.strictEqual(lastRefundBody.out_trade_no, 'BK-BK-MVIY1SS1-858-1792637444636');
  assert.strictEqual(lastRefundBody.transaction_id, '4500000542202610228104943666');
  assert.strictEqual(lastRefundBody.amount.refund, 11000);

  if (savedAllowMock === undefined) delete process.env.ALLOW_MOCK_PAY;
  else process.env.ALLOW_MOCK_PAY = savedAllowMock;
  if (savedProdEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedProdEnv;

  await wechatPay.queryTransactionByOutTradeNo('BK-Q-1');

  assert.ok(fetchCalls.length >= 4, 'prepay/refund/cert/query should share HTTP client');
  fetchCalls.forEach((call) => {
    const ua = call.init && call.init.headers && call.init.headers['User-Agent'];
    assert.strictEqual(ua, 'XinghuoXueban-Server/1.0', `missing User-Agent on ${call.url}`);
    assert.strictEqual(call.init.headers.Accept, 'application/json');
    assert.ok(call.init.headers.Authorization, `missing Authorization on ${call.url}`);
  });
  const paths = fetchCalls.map((c) => String(c.url));
  assert.ok(paths.some((u) => u.indexOf('/v3/certificates') >= 0));
  assert.ok(paths.some((u) => u.indexOf('/v3/pay/transactions/jsapi') >= 0));
  assert.ok(paths.some((u) => u.indexOf('/v3/refund/domestic/refunds') >= 0));
  assert.ok(paths.some((u) => u.indexOf('/v3/pay/transactions/out-trade-no/') >= 0));

  // —— 微信支付公钥模式验签（不再请求平台证书） ——
  const wxKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wxPubPem = wxKeyPair.publicKey.export({ type: 'spki', format: 'pem' });
  process.env.WECHAT_PUBLIC_KEY_PEM = wxPubPem.replace(/\n/g, '\\n');
  assert.strictEqual(wechatPay.isPublicKeyVerifyMode(), true);
  assert.ok(wechatPay.loadWeChatPublicKey().indexOf('BEGIN PUBLIC KEY') >= 0);

  const ts = String(Math.floor(Date.now() / 1000));
  const notifyNonce = 'PUBKEYNONCE';
  const rawNotify = JSON.stringify(notifyBody);
  const notifyMessage = `${ts}\n${notifyNonce}\n${rawNotify}\n`;
  const wxSig = crypto.createSign('RSA-SHA256').update(notifyMessage).sign(wxKeyPair.privateKey, 'base64');

  const certCallsBefore = fetchCalls.filter((c) => String(c.url).indexOf('/v3/certificates') >= 0).length;
  const pubkeyOk = await wechatPay.verifyNotifySignature(
    wxSig,
    ts,
    notifyNonce,
    rawNotify,
    'PUB_KEY_ID_UNITTEST'
  );
  assert.strictEqual(pubkeyOk, true);
  const certCallsAfter = fetchCalls.filter((c) => String(c.url).indexOf('/v3/certificates') >= 0).length;
  assert.strictEqual(certCallsAfter, certCallsBefore, 'public-key verify must not download platform certs');

  const badSig = await wechatPay.verifyNotifySignature(
    'dGVzdA==',
    ts,
    notifyNonce,
    rawNotify,
    'PUB_KEY_ID_UNITTEST'
  );
  assert.strictEqual(badSig, false);

  const signedNotify = await wechatPay.handlePaymentNotify(
    notifyBody,
    {
      'wechatpay-signature': wxSig,
      'wechatpay-timestamp': ts,
      'wechatpay-nonce': notifyNonce,
      'wechatpay-serial': 'PUB_KEY_ID_UNITTEST'
    },
    rawNotify
  );
  assert.strictEqual(signedNotify.tradeState, 'SUCCESS');
  assert.strictEqual(signedNotify.outTradeNo, 'BK-TEST-001-123');

  delete process.env.WECHAT_PUBLIC_KEY_PEM;
  const pubKeyFile = path.join(os.tmpdir(), `wechat-pub-${Date.now()}.pem`);
  fs.writeFileSync(pubKeyFile, wxPubPem);
  process.env.WECHAT_PUBLIC_KEY_PATH = pubKeyFile;
  assert.strictEqual(wechatPay.isPublicKeyVerifyMode(), true);
  const pubkeyFromFile = await wechatPay.verifyNotifySignature(
    wxSig,
    ts,
    notifyNonce,
    rawNotify,
    'PUB_KEY_ID_UNITTEST'
  );
  assert.strictEqual(pubkeyFromFile, true);
  fs.unlinkSync(pubKeyFile);
  delete process.env.WECHAT_PUBLIC_KEY_PATH;

  wechatPay.setWechatPayFetch(null);
  process.env = savedEnv;
  console.log('test-wechat-pay: OK');
}

run().catch((err) => {
  console.error('test-wechat-pay: FAIL', err);
  process.exit(1);
});
