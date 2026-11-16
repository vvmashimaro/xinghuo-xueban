#!/usr/bin/env node
'use strict';

/**
 * 家长建档视觉/行政区/信息卡：静态断言 + 画像归一。
 * 不启服务。数据库写到临时文件，避免碰到 data/db.json。
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const tmpDb = path.join(os.tmpdir(), 'xh-parent-ux-' + process.pid + '.json');
process.env.DATABASE_PATH = tmpDb;

const districts = require('../../js/chengdu-districts');
const miniDistricts = require('../miniprogram/utils/chengdu-districts');
const db = require('./src/db');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function main() {
  const official = [
    '锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区',
    '青白江区', '新都区', '温江区', '双流区', '郫都区', '新津区'
  ];
  assert.deepStrictEqual(districts.OFFICIAL_DISTRICTS, official);
  assert.deepStrictEqual(
    districts.PARENT_DISTRICT_OPTIONS,
    official.concat(['高新区', '天府新区', '其他'])
  );
  assert.deepStrictEqual(miniDistricts.PARENT_DISTRICT_OPTIONS, districts.PARENT_DISTRICT_OPTIONS);
  assert.deepStrictEqual(miniDistricts.LEGACY_DISTRICT_ALIASES, districts.LEGACY_DISTRICT_ALIASES);
  assert.deepStrictEqual(miniDistricts.DISTRICT_TEACHING_POINT, districts.DISTRICT_TEACHING_POINT);

  assert.strictEqual(districts.normalizeCityDistrict('温江/其他'), '温江区');
  assert.strictEqual(districts.normalizeCityDistrict('温江'), '温江区');
  assert.strictEqual(districts.normalizeCityDistrict('天府新区'), '天府新区');
  assert.strictEqual(districts.normalizeCityDistrict('都江堰市'), '都江堰市');
  assert.strictEqual(districts.districtOptionFor('都江堰市'), '其他');
  assert.strictEqual(districts.districtOptionFor('温江/其他'), '温江区');
  assert.strictEqual(districts.districtOptionFor(''), '');
  assert.strictEqual(districts.suggestSpaceForDistrict('青羊区'), '青羊金沙文化微网点');
  assert.strictEqual(districts.suggestSpaceForDistrict('天府新区'), '高新大源中央微网点');
  assert.strictEqual(districts.suggestSpaceForDistrict('温江/其他'), '青羊金沙文化微网点');
  assert.strictEqual(districts.suggestSpaceForDistrict('武侯区'), '武侯川大望江微网点');
  official.concat(['高新区', '天府新区', '其他']).forEach((name) => {
    const space = districts.suggestSpaceForDistrict(name);
    assert.ok(
      ['青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'].indexOf(space) >= 0,
      name + ' 应落到现有网点'
    );
  });

  const saved = db.normalizeParentProfile({
    parentName: '王',
    cityDistrict: '温江/其他',
    phone: '13800000000'
  });
  assert.strictEqual(saved.cityDistrict, '温江区');
  const kept = db.normalizeParentProfile({ cityDistrict: '都江堰市' });
  assert.strictEqual(kept.cityDistrict, '都江堰市');

  const page = read('parent_register.html');
  const indexHtml = read('index.html');
  const dash = read('parent_dashboard.html');
  const miniJs = read('_platform/miniprogram/pages/parent-register/parent-register.js');
  const miniWxml = read('_platform/miniprogram/pages/parent-register/parent-register.wxml');

  assert.ok(page.includes('linear-gradient(105deg, #173d32 0%, #115645 42%, #166b56 78%, #1a7d62 100%)'));
  assert.ok(page.includes('class="parent-trust-banner'));
  assert.ok(!page.includes('from-slate-950 via-slate-900 to-teal-950'));
  assert.ok(page.includes('拒绝违规预付暴雷与安全盲区，为孩子定制阳光精准辅导'));
  assert.ok(page.includes('0 预存·单次约'));
  assert.ok(page.includes('约定合规网点'));
  assert.ok(page.includes('导师学籍资质审核'));
  assert.ok(page.includes('试讲录播可查'));
  assert.ok(page.includes('parent-trust-desc'));
  assert.ok(!/value="温江\/其他"/.test(page), '表单不再提供温江/其他');

  districts.PARENT_DISTRICT_OPTIONS.forEach((name) => {
    assert.ok(page.includes('value="' + name + '"'), '网页选项缺少 ' + name);
  });
  assert.ok(page.includes('value="青羊区" onchange="onCityDistrictChange()" checked'));

  assert.ok(page.includes('id="guardianCard1"'));
  assert.ok(page.includes('id="guardianCard2"'));
  assert.ok(page.includes('id="guardianCard3"'));
  assert.ok(page.includes('id="guardianCard4"'));
  assert.ok(/id="guardianCard1"[^>]*class="guardian-card(?! hidden)/.test(page));
  assert.ok(page.includes('id="guardianCard2" data-guardian-card="2" class="guardian-card hidden'));
  assert.ok(page.includes('id="guardianCard3" data-guardian-card="3" class="guardian-card hidden'));
  assert.ok(page.includes('id="guardianCard4" data-guardian-card="4" class="guardian-card hidden'));
  assert.ok(page.includes('下一步：填写手机与验证码'));
  assert.ok(page.includes('下一步：填写孩子学段'));
  assert.ok(page.includes('下一步：选择常住行政区'));
  assert.ok(page.includes('下一步：选择学科与自适应考纲考点'));
  assert.ok(page.includes('id="btnGuardianToStep2" onclick="goToStep(2)"'));
  assert.ok(page.includes('步骤 1/3 · 1/4'));
  assert.ok(page.includes('function goToGuardianCard'));
  assert.ok(page.includes('function goToStep'));
  assert.ok(page.includes('.guardian-card .g-label'));
  assert.ok(page.includes('font-size: 16px'));
  assert.ok(page.includes('js/chengdu-districts.js'));
  assert.ok(page.includes('id="stepCard2"'));
  assert.ok(page.includes('id="stepCard3"'));

  assert.ok(indexHtml.includes('4 大机制彻底击穿传统家教痛点'));
  assert.ok(indexHtml.includes('bg-white hover:shadow-md transition border border-teal-200 rounded-2xl'));
  assert.ok(!indexHtml.includes('parent-trust-banner'));
  assert.ok(dash.includes('data-matching-banner class="hidden is-compact bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950'));

  assert.ok(miniJs.includes('ChengduDistricts.PARENT_DISTRICT_OPTIONS'));
  assert.ok(miniJs.includes('districtOptionFor'));
  assert.ok(miniJs.includes('suggestSpaceForDistrict'));
  assert.ok(miniWxml.includes('常住行政区'));
  assert.ok(miniWxml.includes('{{spaceHint}}'));
  assert.ok(!miniJs.includes("districts: ['青羊区', '武侯区', '高新区', '锦江区', '成华区', '金牛区']"));

  console.log('✓ 家长建档渐变绿 / 行政区 / 信息卡断言通过');
}

try {
  main();
} finally {
  try { fs.unlinkSync(tmpDb); } catch (e) {}
}
