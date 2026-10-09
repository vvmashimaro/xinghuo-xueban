#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TMP_DB = path.join(__dirname, 'data', 'db.unit-subjects-conflicts.json');
if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
process.env.DATABASE_PATH = TMP_DB;

const subjectCatalog = require('./src/subject-catalog');
const db = require('./src/db');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sessionPayload(date, weekday, start, end) {
  return {
    date,
    weekday,
    weekdayLabel: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][weekday],
    timeStart: start,
    timeEnd: end,
    timeLabel: start + '-' + end
  };
}

function run() {
  console.log('=== Subjects, conflicts & booth tests ===');
  db.reset();

  const catalog = subjectCatalog.getSubjectCatalog();
  assert(catalog.topLevelGradeBands.includes('考研'), 'catalog must include 考研');
  assert(catalog.topLevelGradeBands.includes('艺体'), 'catalog must include 艺体');
  assert(catalog.parentTargetSubjects.includes('体育'), 'parent subjects must include 体育');
  assert(catalog.assessmentSubjects.includes('体育'), 'assessment must include 体育');
  assert(subjectCatalog.gradeBandFromGrade('考研英语冲刺班') === '考研', 'grade band 考研');
  assert(subjectCatalog.gradeBandFromGrade('艺体专项训练') === '艺体', 'grade band 艺体');
  console.log('✓ Subject catalog includes 考研/艺体 and 初中体育');

  const points = db.getTeachingPoints();
  assert(points.length >= 3, 'teaching points seeded');
  points.forEach((tp) => {
    assert(tp.booths && tp.booths.length === 3, tp.name + ' must have 3 booths');
  });
  console.log('✓ Teaching points default to 3 numbered booths');

  const mentorId = 'AP-8802';
  const space = '高新大源中央微网点';
  const parentBase = {
    parentId: 'PAR-TEST-001',
    parentPhone: '13900001111',
    studentNickname: '测试学员',
    mentorId,
    tutorId: mentorId,
    tutorName: '李老师',
    subject: '初中数学',
    space,
    hours: 2,
    type: 'one_off'
  };

  const s1 = sessionPayload('2030-06-15', 6, '14:00', '16:00');
  const first = db.addBooking(
    Object.assign({}, parentBase, {
      sessions: [s1],
      schedule: '2030-06-15 周六 14:00-16:00'
    })
  );
  assert(first && first.id, 'first booking created');
  assert(first.boothId, 'booth auto-assigned');

  const conflict = db.addBooking(
    Object.assign({}, parentBase, {
      mentorId: 'AP-8803',
      tutorId: 'AP-8803',
      subject: '初中英语',
      sessions: [sessionPayload('2030-06-15', 6, '14:00', '16:00')],
      schedule: '2030-06-15 周六 14:00-16:00'
    })
  );
  assert(conflict.ok === false && conflict.code === 'STUDENT_TIME_CONFLICT', 'student overlap blocked');
  console.log('✓ Student time conflict detected');

  const forced = db.addBooking(
    Object.assign({}, parentBase, {
      mentorId: 'AP-8803',
      tutorId: 'AP-8803',
      subject: '初中英语',
      timeConflictForced: true,
      sessions: [sessionPayload('2030-06-15', 6, '14:00', '16:00')],
      schedule: '2030-06-15 周六 14:00-16:00'
    })
  );
  assert(forced && forced.id && forced.hasTimeConflict, 'forced booking stores hasTimeConflict');
  console.log('✓ Force book path sets hasTimeConflict');

  const boothDup = db.addBooking(
    Object.assign({}, parentBase, {
      parentId: 'PAR-TEST-002',
      parentPhone: '13900002222',
      studentNickname: '另一学员',
      boothId: first.boothId,
      teachingPointId: first.teachingPointId,
      sessions: [sessionPayload('2030-06-15', 6, '14:00', '16:00')],
      schedule: '2030-06-15 周六 14:00-16:00'
    })
  );
  assert(boothDup.ok === false && boothDup.code === 'BOOTH_CONFLICT', 'same booth overlap rejected');
  console.log('✓ Same-booth overlap rejected');

  const badTime = db.addBooking(
    Object.assign({}, parentBase, {
      parentId: 'PAR-TEST-003',
      parentPhone: '13900003333',
      studentNickname: '学员三',
      sessions: [sessionPayload('2030-06-16', 1, '08:00', '10:00')],
      schedule: '2030-06-16 周一 08:00-10:00'
    })
  );
  assert(badTime.ok === false && badTime.code === 'MENTOR_UNAVAILABLE', 'mentor availability enforced');
  console.log('✓ Booking requires mentor weekly availability');

  console.log('=== All subjects/conflicts/booth tests passed ===');
}

try {
  run();
} finally {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
}
