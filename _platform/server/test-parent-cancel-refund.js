'use strict';

const assert = require('assert');
const db = require('./src/db');
const wechatPay = require('./src/wechat-pay');

function nextSundayAtLeast(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { dateStr: `${y}-${m}-${day}`, weekday: 0 };
}

async function main() {
  const parent = db.getParents()[0];
  const mentor = db.getMentors().find((m) => m.status === 'approved');
  assert(parent && mentor, 'seed parent/mentor required');

  const far = nextSundayAtLeast(5);
  const created = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    studentGrade: parent.studentGrade || '初三',
    subject: '数学',
    space: '青羊金沙文化微网点',
    schedule: `${far.dateStr} 周日 19:00-21:00`,
    sessionDate: far.dateStr,
    hours: 2,
    weekday: 0,
    time: '19:00',
    sessions: [
      {
        date: far.dateStr,
        weekday: 0,
        timeStart: '19:00',
        timeEnd: '21:00',
        status: 'scheduled'
      }
    ]
  });

  const outTradeNo = `BK-${created.id}-${Date.now()}`;
  db.savePayOrder({
    outTradeNo,
    bookingId: created.id,
    amount: 20000,
    amountYuan: 200,
    status: 'SUCCESS',
    mock: true,
    transactionId: 'MOCK-TX-CANCEL',
    successTime: new Date().toISOString()
  });
  wechatPay.registerMockOrder({
    outTradeNo,
    bookingId: created.id,
    amount: 20000,
    status: 'SUCCESS',
    mock: true
  });

  db.updateBooking(
    created.id,
    { paymentStatus: 'paid', escrowStatus: 'frozen', status: 'pending_accept' },
    { trust: 'admin' }
  );

  const wxRefund = await wechatPay.refundOrder({
    outTradeNo,
    reason: '家长开课前撤销',
    amountFen: 20000
  });
  assert(wxRefund.success, wxRefund.error || 'mock refund failed');

  const dbRefund = db.refundPayOrder(outTradeNo, {
    reason: '家长开课前撤销',
    refundedBy: parent.phone
  });
  assert(dbRefund.ok, dbRefund.error || 'db refund failed');

  const result = db.parentCancelBooking(created.id, parent, { skipRefund: true });
  assert(result.ok, result.error || 'cancel failed');
  assert.strictEqual(result.booking.status, 'cancelled');

  // 复现生产：内存 mockOrders=NOTPAY（真实预下单残留）+ DB SUCCESS，退款必须成功（mock 环境走 mock 成功，不得报未支付）
  const farStale = nextSundayAtLeast(12);
  const staleCreated = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    studentGrade: parent.studentGrade || '初三',
    subject: '物理',
    space: '青羊金沙文化微网点',
    schedule: `${farStale.dateStr} 周日 19:00-21:00`,
    sessionDate: farStale.dateStr,
    hours: 2,
    weekday: 0,
    time: '19:00',
    sessions: [
      {
        date: farStale.dateStr,
        weekday: 0,
        timeStart: '19:00',
        timeEnd: '21:00',
        status: 'scheduled'
      }
    ]
  });
  assert(staleCreated && staleCreated.id, staleCreated && staleCreated.error || 'stale booking');
  const staleOutTradeNo = `BK-${staleCreated.id}-${Date.now()}`;
  db.savePayOrder({
    outTradeNo: staleOutTradeNo,
    bookingId: staleCreated.id,
    amount: 11000,
    amountYuan: 110,
    status: 'SUCCESS',
    mock: false,
    transactionId: '4500000542202610228104943666',
    successTime: new Date().toISOString()
  });
  wechatPay.registerMockOrder({
    outTradeNo: staleOutTradeNo,
    bookingId: staleCreated.id,
    amount: 11000,
    status: 'NOTPAY',
    mock: false
  }, { force: true });
  db.updateBooking(
    staleCreated.id,
    { paymentStatus: 'paid', escrowStatus: 'frozen', status: 'pending_accept' },
    { trust: 'admin' }
  );
  const staleRefund = await wechatPay.refundOrder({
    outTradeNo: staleOutTradeNo,
    reason: '家长开课前撤销',
    amountFen: 11000,
    transactionId: '4500000542202610228104943666'
  });
  assert.notStrictEqual(staleRefund.error, '订单未支付，无法退款');
  assert(staleRefund.success, staleRefund.error || 'stale mockOrders NOTPAY must not block refund');

  // refund_failed 后家长撤销应仍能找到该支付单以便重试
  const farRetry = nextSundayAtLeast(19);
  const retryCreated = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    studentGrade: parent.studentGrade || '初三',
    subject: '物理',
    space: '青羊金沙文化微网点',
    schedule: `${farRetry.dateStr} 周日 19:00-21:00`,
    sessionDate: farRetry.dateStr,
    hours: 2,
    weekday: 0,
    time: '19:00',
    sessions: [
      {
        date: farRetry.dateStr,
        weekday: 0,
        timeStart: '19:00',
        timeEnd: '21:00',
        status: 'scheduled'
      }
    ]
  });
  assert(retryCreated && retryCreated.id, retryCreated && retryCreated.error || 'retry booking');
  const retryOut = `BK-${retryCreated.id}-${Date.now()}`;
  db.savePayOrder({
    outTradeNo: retryOut,
    bookingId: retryCreated.id,
    amount: 11000,
    amountYuan: 110,
    status: 'SUCCESS',
    mock: true,
    transactionId: 'MOCK-TX-RETRY',
    successTime: new Date().toISOString()
  });
  db.updateBooking(
    retryCreated.id,
    { paymentStatus: 'paid', escrowStatus: 'frozen', status: 'pending_accept' },
    { trust: 'admin' }
  );
  const markedFailed = db.refundPayOrder(retryOut, { status: 'ABNORMAL', reason: '订单未支付，无法退款' });
  assert.strictEqual(markedFailed.ok, false);
  assert.strictEqual(db.getPayOrder(retryOut).status, 'refund_failed');
  const retryValidate = db.validateParentCancelBooking(retryCreated.id, parent);
  assert(retryValidate.ok, retryValidate.error || 'refund_failed paid order must remain cancellable');
  assert(retryValidate.payOrder, 'parent cancel retry must see refund_failed payOrder');
  assert.strictEqual(retryValidate.payOrder.status, 'refund_failed');
  wechatPay.registerMockOrder({
    outTradeNo: retryOut,
    bookingId: retryCreated.id,
    amount: 11000,
    status: 'SUCCESS',
    mock: true
  });
  const retryWx = await wechatPay.refundOrder({
    outTradeNo: retryOut,
    reason: '家长开课前撤销（重试）',
    amountFen: 11000,
    transactionId: 'MOCK-TX-RETRY'
  });
  assert(retryWx.success, retryWx.error || 'retry refund after refund_failed should succeed');

  // 未支付撤销：不得把 escrow 标成已退款
  const farUnpaid = nextSundayAtLeast(26);
  const unpaidCreated = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    studentGrade: parent.studentGrade || '初三',
    subject: '物理',
    space: '青羊金沙文化微网点',
    schedule: `${farUnpaid.dateStr} 周日 19:00-21:00`,
    sessionDate: farUnpaid.dateStr,
    hours: 2,
    weekday: 0,
    time: '19:00',
    sessions: [
      {
        date: farUnpaid.dateStr,
        weekday: 0,
        timeStart: '19:00',
        timeEnd: '21:00',
        status: 'scheduled'
      }
    ]
  });
  assert(unpaidCreated && unpaidCreated.id, unpaidCreated && unpaidCreated.error || 'unpaid booking');
  const unpaidCancel = db.parentCancelBooking(unpaidCreated.id, parent);
  assert(unpaidCancel.ok, unpaidCancel.error || 'unpaid cancel should succeed');
  assert.strictEqual(unpaidCancel.booking.status, 'cancelled');
  assert.strictEqual(unpaidCancel.booking.paymentStatus, 'unpaid');
  assert.strictEqual(unpaidCancel.booking.escrowStatus, 'pending_payment');
  assert.ok(
    (unpaidCancel.booking.sessions || []).every((s) => s.escrowStatus !== 'refunded'),
    'unpaid cancel must not claim session escrow refunded'
  );

  console.log('=== parent cancel refund path tests passed ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
