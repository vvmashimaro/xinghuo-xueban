'use strict';

const assert = require('assert');
const db = require('./src/db');

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

  console.log('=== parent cancel tests passed ===');
}

main();
