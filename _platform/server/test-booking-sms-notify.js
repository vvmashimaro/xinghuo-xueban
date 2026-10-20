'use strict';

const assert = require('assert');
const sms = require('./src/sms');
const bookingSmsNotify = require('./src/booking-sms-notify');
const db = require('./src/db');

async function main() {
  process.env.SMS_PROVIDER = 'mock';

  assert.strictEqual(sms.resolveTencentTemplateId('refund'), '');
  process.env.TENCENT_SMS_TEMPLATE_REFUND = 'tpl-refund-test';
  assert.strictEqual(sms.resolveTencentTemplateId('refund'), 'tpl-refund-test');

  const loginParams = sms.buildTemplateParamSet('login', { code: '123456', minutes: 5 });
  assert.deepStrictEqual(loginParams, ['123456', '5']);

  const bookingParams = sms.buildTemplateParamSet('booking', {
    studentName: '小明',
    subject: '数学',
    schedule: '周日 10:00',
    space: '金沙网点'
  });
  assert.deepStrictEqual(bookingParams, ['小明', '数学', '周日 10:00', '金沙网点']);

  const refundParams = sms.buildTemplateParamSet('refund', {
    subject: '英语',
    amountYuan: 120,
    schedule: '2026-10-20 19:00'
  });
  assert.deepStrictEqual(refundParams, ['英语', '120.00', '2026-10-20 19:00']);

  const declineParams = sms.buildTemplateParamSet('cancel', {
    tutorName: '张老师',
    studentName: '小明',
    subject: '数学',
    schedule: '2026-10-20 19:00',
    reason: '导师暂时无法承接',
    cancelledBy: 'mentor'
  });
  assert.deepStrictEqual(declineParams, ['张老师', '数学', '2026-10-20 19:00', '导师暂时无法承接']);

  const mentorCancelParams = sms.buildTemplateParamSet('cancel_mentor', {
    studentName: '小明',
    subject: '数学',
    schedule: '2026-10-20 19:00'
  });
  assert.deepStrictEqual(mentorCancelParams, ['小明', '数学', '2026-10-20 19:00']);

  const accept = await sms.sendBookingAcceptNotification('13980889211', {
    tutorName: '李老师',
    subject: '英语',
    schedule: '周日 10:00',
    space: '金沙网点'
  });
  assert(accept.success, 'accept mock should succeed');

  const parent = db.getParents()[0];
  const mentor = db.getMentors().find((m) => m.status === 'approved');
  assert(parent && mentor, 'seed data required');

  const booking = {
    parentPhone: parent.phone,
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    studentNickname: '测试学员',
    subject: '化学',
    schedule: '周六 14:00',
    space: '测试网点',
    declineReason: '时间冲突'
  };

  await bookingSmsNotify.notifyBookingCreated(booking, db);
  await bookingSmsNotify.notifyBookingRespond(booking, { action: 'accept' }, db);
  await bookingSmsNotify.notifyBookingRespond(booking, { action: 'decline', reason: '时间冲突' }, db);
  await bookingSmsNotify.notifyParentCancel(booking, db);

  console.log('test-booking-sms-notify: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
