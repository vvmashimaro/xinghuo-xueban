#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TMP_DB = path.join(__dirname, 'data', 'db.public-browse-test.json');
if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
process.env.DATABASE_PATH = TMP_DB;
process.env.PORT = '18787';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'development';

const db = require('./src/db');
const parentBrowseFilter = require('./src/parent-browse-filter');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(base, path) {
  const res = await fetch(base + path);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function run() {
  console.log('=== Public mentor browse API tests ===');
  db.reset();
  require('./src/index.js');
  const base = 'http://127.0.0.1:18787';
  await sleep(800);

  const catalog = await request(base, '/api/public/browse-catalog');
  if (catalog.status !== 200) throw new Error('catalog status ' + catalog.status);
  if (!catalog.json.gradeSubjects || !catalog.json.gradeSubjects['初中']) {
    throw new Error('missing gradeSubjects');
  }

  const list = await request(base, '/api/public/mentors');
  if (list.status !== 200) throw new Error('list status ' + list.status);
  if (!Array.isArray(list.json)) throw new Error('expected array');
  list.json.forEach((m) => {
    if (m.phone !== undefined) throw new Error('phone leaked');
    if (m.lectureUrl !== undefined) throw new Error('lectureUrl should be stripped');
    if (m.idCard !== undefined) throw new Error('idCard leaked');
  });

  const mentors = db.getMentors().filter((m) => m.status === 'approved');
  const filtered = parentBrowseFilter.filterBrowseMentors(mentors, {
    grade: '初中',
    subject: '数学',
    time: '全部'
  });
  if (!filtered.length && mentors.length) {
    console.warn('warn: filter returned empty but mentors exist (seed subjects may differ)');
  }

  console.log('✓ public mentor browse API ok (' + list.json.length + ' mentors, filter sample ' + filtered.length + ')');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
