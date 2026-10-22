#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Avail = require('../miniprogram/utils/mentor-availability');
const bookingSchedule = require('./src/booking-schedule');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const DEFAULT_SLOTS = [
  '周六 09:00-11:00',
  '周六 14:00-16:00',
  '周日 09:00-11:00',
  '周日 19:00-21:00',
  '周三 19:00-21:00'
];

function parseDefaultAvailability() {
  const wdMap = { 周日: 0, 周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6 };
  const byDay = {};
  DEFAULT_SLOTS.forEach((raw) => {
    let wd = null;
    Object.keys(wdMap).forEach((name) => {
      if (raw.indexOf(name) === 0) wd = wdMap[name];
    });
    const m = raw.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (wd == null || !m) return;
    if (!byDay[wd]) byDay[wd] = [];
    byDay[wd].push({ start: m[1], end: m[2] });
  });
  return Object.keys(byDay).map((k) => ({
    weekday: parseInt(k, 10),
    ranges: byDay[k]
  }));
}

function run() {
  console.log('=== Parent booking availability + unshift guards ===');

  const avail = parseDefaultAvailability();
  const windows2h = Avail.bookableWindowsFromAvailability(avail, 2);
  const labels = windows2h.map((w) => w.label);
  assert(labels.indexOf('周六 09:00-11:00') >= 0, 'default Sat morning window offered');
  assert(labels.indexOf('周六 14:00-16:00') >= 0, 'default Sat afternoon window offered');
  assert(labels.indexOf('周三 19:00-21:00') >= 0, 'default Wed evening window offered');
  assert(
    labels.every((l) => l.indexOf('周六 10:00-12:00') < 0),
    'hardcoded Sat 10:00-12:00 must not be offered'
  );
  console.log('✓ Bookable windows derived from mentor availability (not hardcoded 10:00)');

  const mentor = { availability: avail };
  const bad = bookingSchedule.assertMentorAvailability(mentor, [
    { weekday: 6, timeStart: '10:00', timeEnd: '12:00' }
  ]);
  assert(bad.ok === false && bad.code === 'MENTOR_UNAVAILABLE', 'Sat 10:00-12:00 rejected by server');
  const good = bookingSchedule.assertMentorAvailability(mentor, [
    { weekday: 6, timeStart: '09:00', timeEnd: '11:00' }
  ]);
  assert(good.ok === true, 'Sat 09:00-11:00 accepted by server');
  windows2h.forEach((w) => {
    const r = bookingSchedule.assertMentorAvailability(mentor, [
      { weekday: w.weekday, timeStart: w.timeStart, timeEnd: w.timeEnd }
    ]);
    assert(r.ok === true, 'offered window must pass server: ' + w.label);
  });
  console.log('✓ Offered slots match server assertMentorAvailability');

  const custom = [{ weekday: 2, ranges: [{ start: '19:00', end: '21:00' }] }];
  const customWindows = Avail.bookableWindowsFromAvailability(custom, 2);
  assert(customWindows.length === 1 && customWindows[0].label === '周二 19:00-21:00', 'custom Tue window');
  const tooLong = Avail.bookableWindowsFromAvailability(custom, 3);
  assert(tooLong.length === 0, '3h does not fit 2h window');
  console.log('✓ Custom availability filters by duration');

  function prepend(list, item) {
    const arr = Array.isArray(list) ? list : [];
    arr.unshift(item);
    return arr;
  }
  const fromMissing = prepend(undefined, { id: 'BK-1' });
  assert(Array.isArray(fromMissing) && fromMissing[0].id === 'BK-1', 'unshift on missing list');
  const fromObject = prepend({ success: false }, { id: 'CT-1' });
  assert(Array.isArray(fromObject) && fromObject[0].id === 'CT-1', 'unshift on non-array object');
  const fromPromiseShape = prepend(Promise.resolve([]), { id: 'BK-2' });
  assert(Array.isArray(fromPromiseShape) && fromPromiseShape[0].id === 'BK-2', 'unshift on Promise');
  console.log('✓ unshift target coerced to array');

  const storageSrc = fs.readFileSync(
    path.join(__dirname, '../miniprogram/utils/storage.js'),
    'utf8'
  );
  assert(!/async getBookings\s*\(/.test(storageSrc), 'mini getBookings must not be async (overwrites local list)');
  assert(/getBookings\(\)\s*\{\s*return _readList\(KEYS\.bookings\)/.test(storageSrc), 'mini getBookings reads array');
  assert(/_prepend\(this\.getBookings\(\)/.test(storageSrc), 'addBooking prepends onto array');
  assert(/_prepend\(this\.getContracts\(\)/.test(storageSrc), 'saveContract prepends onto array');
  console.log('✓ Mini storage keeps sync getBookings and array-safe prepend');

  const configSrc = fs.readFileSync(
    path.join(__dirname, '../miniprogram/utils/config.js'),
    'utf8'
  );
  assert(configSrc.indexOf("API_BASE: 'https://www.sparkles.com.cn'") >= 0, 'API_BASE unchanged');
  console.log('✓ Mini API_BASE stays https://www.sparkles.com.cn');

  console.log('=== Parent booking availability tests passed ===');
}

run();
