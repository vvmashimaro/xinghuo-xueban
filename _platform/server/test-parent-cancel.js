'use strict';

const assert = require('assert');
const db = require('./src/db');
const bookingSchedule = require('./src/booking-schedule');

function nextSundayAtLeast(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { dateStr: `${y}-${m}-${day}`, weekday: 0 };
}

function main() {
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
        timeLabel: '19:00-21:00',
        status: 'scheduled'
      }
    ]
  });
  assert(created && created.id, 'booking created');

  db.updateBooking(
    created.id,
    {
      paymentStatus: 'paid',
      escrowStatus: 'frozen',
      sessions: [
        {
          id: 'SES-CANCEL-TEST',
          date: far.dateStr,
          weekday: 0,
          timeStart: '14:00',
          timeEnd: '16:00',
          timeLabel: '14:00-16:00',
          status: 'scheduled',
          escrowStatus: 'frozen'
        }
      ]
    },
    { trust: 'admin' }
  );

  const ok = db.parentCancelBooking(created.id, parent);
  assert(ok.ok, ok.error || 'cancel should succeed');
  assert(ok.booking.status === 'cancelled', 'status cancelled');

  const soon = new Date();
  soon.setHours(soon.getHours() + 1);
  const sy = soon.getFullYear();
  const sm = String(soon.getMonth() + 1).padStart(2, '0');
  const sd = String(soon.getDate()).padStart(2, '0');
  const soonDate = `${sy}-${sm}-${sd}`;
  const soonStart = `${String(soon.getHours()).padStart(2, '0')}:00`;

  const soonBooking = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    studentGrade: parent.studentGrade || '初三',
    subject: '物理',
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
  assert(soonBooking && soonBooking.id, 'soon booking created');
  db.updateBooking(
    soonBooking.id,
    {
      paymentStatus: 'paid',
      status: 'pending_accept',
      schedule: `${soonDate} ${soonStart}-16:00`,
      sessionDate: soonDate,
      sessions: [
        {
          id: 'SES-SOON',
          date: soonDate,
          timeStart: soonStart,
          timeEnd: '16:00',
          status: 'scheduled'
        }
      ]
    },
    { trust: 'admin' }
  );

  const deny = db.parentCancelBooking(soonBooking.id, parent);
  assert(!deny.ok && deny.tooLate, 'cancel within 2h should fail');

  assert.strictEqual(typeof bookingSchedule.parseOneOffSessionFromSchedule, 'function');
  const parsed = bookingSchedule.parseOneOffSessionFromSchedule({
    schedule: `${far.dateStr} 周日 20:00-21:00`
  });
  assert(parsed, 'schedule-only booking must parse');
  assert.strictEqual(parsed.timeStart, '20:00');
  assert.strictEqual(parsed.date, far.dateStr);

  const farSchedule = nextSundayAtLeast(12);
  const scheduleOnly = db.addBooking({
    mentorId: mentor.id,
    tutorId: mentor.id,
    tutorName: mentor.realName || '导师',
    parentId: parent.id,
    parentPhone: parent.phone,
    studentNickname: parent.studentNickname || '学员',
    studentGrade: parent.studentGrade || '初三',
    subject: '物理',
    space: '青羊金沙文化微网点',
    schedule: `${farSchedule.dateStr} 周日 19:00-21:00`,
    sessionDate: farSchedule.dateStr,
    hours: 2,
    weekday: 0,
    time: '19:00',
    sessions: []
  });
  assert(scheduleOnly && scheduleOnly.id, scheduleOnly && scheduleOnly.error || 'schedule-only booking');
  db.updateBooking(scheduleOnly.id, { sessions: [] }, { trust: 'admin' });
  const scheduleOnlyCancel = db.validateParentCancelBooking(scheduleOnly.id, parent);
  assert(scheduleOnlyCancel.ok, scheduleOnlyCancel.error || 'schedule-only cancel must not TypeError');

  const farUnpaid = nextSundayAtLeast(19);
  const unpaid = db.addBooking({
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
  assert(unpaid && unpaid.id, unpaid && unpaid.error || 'unpaid booking');
  const unpaidCancel = db.parentCancelBooking(unpaid.id, parent);
  assert(unpaidCancel.ok, unpaidCancel.error || 'unpaid cancel should succeed');
  assert.strictEqual(unpaidCancel.booking.escrowStatus, 'pending_payment');
  assert.strictEqual(unpaidCancel.booking.paymentStatus, 'unpaid');

  console.log('=== parent cancel tests passed ===');
}

main();
