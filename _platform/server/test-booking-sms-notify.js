'use strict';

const assert = require('assert');
const sms = require('./src/sms');
const bookingSmsNotify = require('./src/booking-sms-notify');
const db = require('./src/db');

async function main() {
  process.env.SMS_PROVIDER = 'mock';

  const params = sms.buildTemplateParamSet('cancel', {
    tutorName: '张老师',
    studentName: '小明',
    subject: '数学',
    schedule: '2026-10-20 19:00',
    reason: '导师暂时无法承接',
    cancelledBy: 'mentor'
  });
  assert.deepStrictEqual(params, ['张老师', '数学', '2026-10-20 19:00', '导师暂时无法承接']);

  const parentParams = sms.buildTemplateParamSet('cancel', {
    tutorName: '张老师',
    studentName: '小明',
    subject: '数学',
    schedule: '2026-10-20 19:00',
    reason: '家长已撤销约课',
    cancelledBy: 'parent'
  });
  assert.deepStrictEqual(parentParams, ['小明', '数学', '2026-10-20 19:00', '家长已撤销约课']);

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

  await bookingSmsNotify.notifyBookingRespond(booking, { action: 'accept' }, db);
  await bookingSmsNotify.notifyBookingRespond(booking, { action: 'decline' }, db);
  await bookingSmsNotify.notifyParentCancel(booking, db);

  console.log('test-booking-sms-notify: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
