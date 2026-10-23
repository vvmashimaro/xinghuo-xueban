'use strict';

const assert = require('assert');
const db = require('./src/db');
const bookingFields = require('./src/booking-fields');

function farFutureSunday() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function main() {
  const parent = db.getParents()[0];
  const mentors = db.getMentors().filter((m) => m.status === 'approved');
  assert(parent && mentors.length, 'seed parent/mentor required');

  const synthetic = [
    {
      type: 'trial',
      parentId: parent.id,
      mentorId: mentors[0].id,
      status: 'accepted',
      sessions: [{ status: 'completed', date: '2024-06-01', timeStart: '10:00' }]
    }
  ];
  const completedGate = bookingFields.evaluateParentFreeTrialWithMentor(synthetic, parent, mentors[0].id);
  assert(completedGate.blocked && completedGate.code === 'TRIAL_USED', 'completed session blocks');

  const activeGate = bookingFields.evaluateParentFreeTrialWithMentor(
    [
      {
        type: 'trial',
        parentId: parent.id,
        mentorId: mentors[0].id,
        status: 'pending_accept',
        sessions: [{ status: 'scheduled', date: '2099-01-01', timeStart: '10:00' }]
      }
    ],
    parent,
    mentors[0].id
  );
  assert(activeGate.blocked && activeGate.code === 'TRIAL_ACTIVE', 'active pending blocks');

  const cancelledOk = bookingFields.evaluateParentFreeTrialWithMentor(
    [
      {
        type: 'trial',
        parentId: parent.id,
        mentorId: mentors[0].id,
        status: 'cancelled',
        sessions: [{ status: 'scheduled', date: '2024-01-01', timeStart: '10:00' }]
      }
    ],
    parent,
    mentors[0].id
  );
  assert(!cancelledOk.blocked, 'cancelled trial does not block');

  db.getBookings().forEach((b) => {
    if (b.parentId === parent.id && b.type === 'trial' && b.status !== 'cancelled' && b.status !== 'declined') {
      db.updateBooking(b.id, { status: 'cancelled', cancelledBy: 'test' }, { trust: 'admin' });
    }
  });
  const mentor = mentors[0];

  const far = farFutureSunday();
  const first = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    subject: '数学',
    type: 'trial',
    space: '青羊金沙文化微网点',
    schedule: `${far} 周日 19:00-20:00`,
    hours: 1,
    sessions: [{ date: far, timeStart: '19:00', timeEnd: '20:00', status: 'scheduled' }]
  });
  assert(first && first.id, first && first.error || 'first trial create');

  const dup = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    subject: '英语',
    type: 'trial',
    space: '青羊金沙文化微网点',
    schedule: `${far} 周日 14:00-15:00`,
    hours: 1,
    sessions: [{ date: far, timeStart: '14:00', timeEnd: '15:00', status: 'scheduled' }]
  });
  assert(dup && dup.ok === false && dup.code === 'TRIAL_ACTIVE', 'duplicate active trial blocked');

  const sessions = (first.sessions || []).map((s) =>
    Object.assign({}, s, { status: 'completed', completedAt: new Date().toISOString() })
  );
  db.updateBooking(first.id, { status: 'accepted', sessions }, { trust: 'admin' });

  const afterComplete = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    subject: '物理',
    type: 'trial',
    space: '青羊金沙文化微网点',
    schedule: `${far} 周日 16:00-17:00`,
    hours: 1,
    sessions: [{ date: far, timeStart: '16:00', timeEnd: '17:00', status: 'scheduled' }]
  });
  assert(
    afterComplete && afterComplete.ok === false && afterComplete.code === 'TRIAL_USED',
    'trial after completed session blocked'
  );

  console.log('=== parent free trial uniqueness tests passed ===');
}

main();
