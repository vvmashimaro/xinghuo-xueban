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

  console.log('=== parent cancel refund path tests passed ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
