'use strict';

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `xh-reconcile-${Date.now()}.json`);
process.env.DATABASE_PATH = tmpDb;
process.env.NODE_ENV = 'development';
process.env.ALLOW_MOCK_PAY = 'true';

const db = require('./src/db');
const wechatPay = require('./src/wechat-pay');
const { reconcileWechatPay } = require('./src/pay-reconcile');

db.reset();
db.seedIfEmpty();

const booking = db.getBookings()[0];
assert.ok(booking && booking.id, 'need seeded booking');

const outTradeNo = 'BK-RECON-PEND-1';
db.savePayOrder({
  outTradeNo,
  bookingId: booking.id,
  amount: 11000,
  amountYuan: 110,
  status: 'refund_pending',
  refundReason: '家长开课前撤销',
  mock: false
});

wechatPay.setWechatPayFetch(async (url) => {
  const pathName = String(url).replace(/^https:\/\/api\.mch\.weixin\.qq.com/, '');
  if (pathName.indexOf('/v3/refund/domestic/refunds/out-trade-no/') >= 0) {
    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              out_refund_no: 'RF-RECON-1',
              out_trade_no: outTradeNo,
              refund_id: 'wx-refund-recon-1',
              status: 'SUCCESS',
              success_time: '2026-10-24T10:00:00+08:00',
              amount: { refund: 11000 }
            }
          ]
        })
    };
  }
  return { status: 404, text: async () => '{}' };
});

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' });
process.env.WECHAT_MCH_ID = '1230000000';
process.env.WECHAT_APP_ID = 'wx-unit-test';
process.env.WECHAT_API_V3_KEY = 'unit-test-api-v3-key-32bytes!!';
process.env.WECHAT_MCH_SERIAL_NO = 'MCHSERIALUNITTEST';
process.env.WECHAT_PRIVATE_KEY_PEM = pem.toString().replace(/\n/g, '\\n');
process.env.WECHAT_NOTIFY_URL = 'https://example.com/api/pay/wechat/notify';

(async () => {
  const dry = await reconcileWechatPay({ db, wechatPay }, { outTradeNo });
  assert.strictEqual(dry.dryRun, true);
  assert.strictEqual(dry.mismatchCount, 1);
  assert.strictEqual(dry.mismatches[0].kind, 'refund_pending_vs_wx_success');
  assert.strictEqual(db.getPayOrder(outTradeNo).status, 'refund_pending');

  const applied = await reconcileWechatPay({ db, wechatPay }, { outTradeNo, apply: true });
  assert.strictEqual(applied.applied.length, 1);
  assert.strictEqual(db.getPayOrder(outTradeNo).status, 'REFUND');
  const refreshedBooking = db.getBookings().find((b) => b.id === booking.id);
  assert.strictEqual(refreshedBooking.paymentStatus, 'refunded');

  console.log('=== pay reconcile tests passed ===');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
