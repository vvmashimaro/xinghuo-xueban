#!/usr/bin/env node
'use strict';

/**
 * Admin teaching-point booth APIs: list, resize, shrink guard, occupancy.
 */

const fs = require('fs');
const path = require('path');

const TMP_DB = path.join(__dirname, 'data', 'db.admin-tp-test.json');
if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
process.env.DATABASE_PATH = TMP_DB;
process.env.PORT = '18788';
process.env.HOST = '127.0.0.1';

const db = require('./src/db');
const auth = require('./src/auth');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(base, method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}
    ),
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function run() {
  console.log('=== Admin teaching-point API tests ===');
  db.reset();
  require('./src/index.js');
  const base = 'http://127.0.0.1:18788';
  await sleep(800);

  const adminToken = auth.createToken('ADMIN-TP-TEST', 'admin', '13540012341', db);
  const parentToken = auth.createToken('PAR-TP', 'parent', '13980889211', db);

  const list = await request(base, 'GET', '/api/admin/teaching-points', null, adminToken);
  assert(list.status === 200 && Array.isArray(list.json), 'admin list teaching points');
  const tp = list.json[0];
  assert(tp.booths && tp.booths.length === 3, 'default 3 booths');
  console.log('✓ Admin can list teaching points with 3 booths');

  const deny = await request(base, 'PATCH', '/api/admin/teaching-points/' + tp.id, { boothCount: 5 }, parentToken);
  assert(deny.status === 403, 'parent cannot patch booth count');
  console.log('✓ Non-admin PATCH rejected');

  const grow = await request(base, 'PATCH', '/api/admin/teaching-points/' + tp.id, { boothCount: 5 }, adminToken);
  assert(grow.status === 200 && grow.json.booths.length === 5, 'grow to 5 booths');
  console.log('✓ Admin can increase booth count');

  const booth5 = grow.json.booths[4].id;
  const session = {
    date: '2032-03-15',
    weekday: 3,
    timeStart: '19:00',
    timeEnd: '21:00',
    timeLabel: '19:00-21:00'
  };
  const booking = db.addBooking({
    parentId: 'PAR-X',
    parentPhone: '13900009999',
    studentNickname: '测试',
    mentorId: 'AP-8802',
    tutorId: 'AP-8802',
    tutorName: '李老师',
    subject: '初中数学',
    space: tp.name,
    teachingPointId: tp.id,
    boothId: booth5,
    boothLabel: '仓位5',
    hours: 2,
    type: 'one_off',
    sessions: [session],
    schedule: '2032-03-15 周三 19:00-21:00'
  });
  assert(booking && booking.id, 'booking on booth 5');

  const shrinkFail = await request(
    base,
    'PATCH',
    '/api/admin/teaching-points/' + tp.id,
    { boothCount: 3 },
    adminToken
  );
  assert(shrinkFail.status === 400 && shrinkFail.json.code === 'BOOTH_SHRINK_BLOCKED', 'shrink blocked');
  console.log('✓ Shrink blocked when active booking on removed booth');

  const occ = await request(
    base,
    'GET',
    '/api/admin/teaching-points/' + tp.id + '/occupancy?date=2032-03-15',
    null,
    adminToken
  );
  assert(occ.status === 200 && occ.json.booths, 'occupancy response');
  const busy = occ.json.booths.find((b) => b.boothId === booth5);
  assert(busy && busy.bookings && busy.bookings.length === 1, 'occupancy shows booth 5 booking');
  console.log('✓ Occupancy API lists booth booking for date');

  const catalog = await request(base, 'GET', '/api/subject-catalog', null, null);
  assert(
    catalog.json.topLevelGradeBands &&
      catalog.json.topLevelGradeBands.includes('考研') &&
      catalog.json.parentTargetSubjects.includes('体育'),
    'subject catalog public'
  );
  console.log('✓ Subject catalog includes 考研/艺体/体育');

  const limitedToken = auth.createToken('ADMIN-LIMITED-TP', 'admin', '18080141668', db);
  const noModule = await request(base, 'POST', '/api/admin/teaching-points', { name: '无权教学点' }, limitedToken);
  assert(noModule.status === 403, 'admin without warehouse module cannot add');
  const parentAdd = await request(base, 'POST', '/api/admin/teaching-points', { name: '家长教学点' }, parentToken);
  assert(parentAdd.status === 403, 'parent cannot add teaching point');
  const anon = await request(base, 'DELETE', '/api/admin/teaching-points/' + tp.id, null, null);
  assert(anon.status === 401, 'anonymous delete rejected');

  const missingName = await request(base, 'POST', '/api/admin/teaching-points', { name: '  ' }, adminToken);
  assert(missingName.status === 400 && missingName.json.code === 'NAME_REQUIRED', 'name required');

  const created = await request(
    base,
    'POST',
    '/api/admin/teaching-points',
    { name: '测试锦江独立教学点' },
    adminToken
  );
  assert(created.status === 200 && created.json.booths && created.json.booths.length === 3, 'new point has 3 booths');
  assert(created.json.name === '测试锦江独立教学点', 'name saved');
  const dup = await request(
    base,
    'POST',
    '/api/admin/teaching-points',
    { name: '测试锦江独立教学点' },
    adminToken
  );
  assert(dup.status === 400 && dup.json.code === 'DUPLICATE_NAME', 'duplicate name rejected');

  const beforeBookings = db.getBookings().length;
  const active = {
    id: 'BK-TP-ACTIVE',
    parentId: 'PAR-X',
    parentPhone: '13900008888',
    mentorId: 'AP-8802',
    tutorId: 'AP-8802',
    status: 'pending_accept',
    escrowStatus: 'frozen',
    space: created.json.name,
    teachingPointId: created.json.id,
    boothId: created.json.booths[0].id,
    subject: '初中数学'
  };
  const bookings = db.getBookings();
  bookings.push(active);
  db.replaceSnapshot({ bookings });

  const blocked = await request(
    base,
    'DELETE',
    '/api/admin/teaching-points/' + created.json.id,
    null,
    adminToken
  );
  assert(blocked.status === 400 && blocked.json.code === 'TEACHING_POINT_IN_USE', 'active booking blocks delete');
  assert(blocked.json.bookingIds && blocked.json.bookingIds.indexOf('BK-TP-ACTIVE') >= 0, 'returns booking id');
  const stillThere = db.getTeachingPoints().find((item) => item.id === created.json.id);
  assert(stillThere, 'point remains after blocked delete');
  assert(db.getBookings().some((b) => b.id === 'BK-TP-ACTIVE'), 'booking not destroyed');

  const cancelled = db.getBookings().map((b) =>
    b.id === 'BK-TP-ACTIVE' ? Object.assign({}, b, { status: 'cancelled' }) : b
  );
  db.replaceSnapshot({ bookings: cancelled });
  const removed = await request(
    base,
    'DELETE',
    '/api/admin/teaching-points/' + created.json.id,
    null,
    adminToken
  );
  assert(removed.status === 200, 'delete allowed after booking cancelled');
  assert(!db.getTeachingPoints().some((item) => item.id === created.json.id), 'point gone');
  assert(db.getBookings().length === beforeBookings + 1, 'booking row kept');
  const again = await request(base, 'GET', '/api/admin/teaching-points', null, adminToken);
  assert(!again.json.some((item) => item.id === created.json.id), 'deleted point is not reseeded');

  const idle = again.json.find((item) => item.name === '武侯川大望江微网点');
  assert(idle, 'idle default point exists');
  const dropIdle = await request(base, 'DELETE', '/api/admin/teaching-points/' + idle.id, null, adminToken);
  assert(dropIdle.status === 200, 'idle default point can be deleted');
  const afterIdle = await request(base, 'GET', '/api/admin/teaching-points', null, adminToken);
  assert(!afterIdle.json.some((item) => item.name === '武侯川大望江微网点'), 'deleted default stays deleted');

  console.log('✓ Add/delete teaching point safeguards OK');
  console.log('=== Admin teaching-point tests passed ===');
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
  process.exit(0);
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
    if (process.exitCode) process.exit(process.exitCode);
  });
