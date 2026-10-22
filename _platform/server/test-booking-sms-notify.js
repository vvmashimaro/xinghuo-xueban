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

  assert.strictEqual(sms.sceneUsesTemplateVariables('login'), true);
  assert.strictEqual(sms.sceneUsesTemplateVariables('booking'), false);
  assert.strictEqual(sms.sceneUsesTemplateVariables('refund'), false);

  const loginParams = sms.buildTemplateParamSet('login', { code: '123456', minutes: 5 });
  assert.deepStrictEqual(loginParams, ['123456', '5']);

  assert.deepStrictEqual(sms.buildTemplateParamSet('booking', { studentName: '小明' }), []);
  assert.deepStrictEqual(sms.buildTemplateParamSet('refund', { amountYuan: 120 }), []);

  assert.strictEqual(
    sms.notificationFixedCopy('booking'),
    sms.NOTIFICATION_FIXED_COPY.booking
  );
  assert.strictEqual(
    sms.notificationFixedCopy('cancel'),
    '抱歉，导师暂无法承接本次约课，请登录星火学伴重新选择导师。'
  );

  const accept = await sms.sendBookingAcceptNotification('13980889211', {
    tutorName: '李老师',
    subject: '英语',
    schedule: '周日 10:00',
    space: '金沙网点'
  });
  assert(accept.success, 'accept mock should succeed');
  assert.strictEqual(accept.message, sms.NOTIFICATION_FIXED_COPY.accept);

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

  const refund = await sms.sendRefundNotification(parent.phone, {
    subject: '化学',
    amountYuan: 99,
    refunded: true
  });
  assert.strictEqual(refund.message, sms.NOTIFICATION_FIXED_COPY.refund);

  assert.strictEqual(
    bookingSmsNotify.shouldSendRefundSmsOnCancel(null, { paymentStatus: 'unpaid' }),
    false
  );
  assert.strictEqual(
    bookingSmsNotify.shouldSendRefundSmsOnCancel(
      { amountYuan: 110, outTradeNo: 'BK-X' },
      { paymentStatus: 'unpaid' }
    ),
    false
  );
  assert.strictEqual(
    bookingSmsNotify.shouldSendRefundSmsOnCancel(
      { amountYuan: 110, outTradeNo: 'BK-X' },
      { paymentStatus: 'paid' }
    ),
    true
  );
  assert.ok(
    sms.NOTIFICATION_FIXED_COPY.refund.indexOf('退款将原路退回') >= 0,
    'refund copy still used for paid cancels only'
  );

  console.log('test-booking-sms-notify: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
