#!/usr/bin/env node
'use strict';

/**
 * 选择学伴落地与共享学伴卡：文案、匹配、核验章。
 * 不启服务。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const card = require(path.join(ROOT, 'js/companion-card.js'));

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function main() {
  assert.strictEqual(card.maskName('张若愚'), '张老师');
  assert.strictEqual(card.maskName('欧阳娜娜'), '欧阳老师');
  assert.strictEqual(card.displayName({ maskedName: '李老师', realName: '李明' }), '李老师');

  const mentors = [
    {
      id: 'A',
      status: 'approved',
      chsiStatus: '有效 (在籍)',
      university: '四川大学',
      subjects: ['初中数学'],
      styles: ['引导启发解题'],
      hourlyRate: 120,
      realName: '李明',
      maskedName: '李老师'
    },
    {
      id: 'B',
      status: 'approved',
      chsiStatus: '有效 (在籍)',
      university: '电子科技大学',
      subjects: ['高中物理'],
      styles: ['错题本高效提分法'],
      hourlyRate: 150,
      realName: '陈华'
    }
  ];

  const exact = card.filterCompanions(mentors, { grade: '初二', subject: '数学', style: '引导启发' });
  assert.strictEqual(exact.mode, 'exact');
  assert.strictEqual(exact.list.length, 1);
  assert.strictEqual(exact.list[0].id, 'A');

  const none = card.filterCompanions(mentors, { grade: '初二', subject: '化学', style: '跟读带练' });
  assert.strictEqual(none.mode, 'recommend');
  assert.strictEqual(none.exactMatch, false);
  assert.strictEqual(none.list.length, 2);
  const noneCopy = card.matchCopy(none.mode, { grade: '初二', subject: '化学', style: '跟读带练' });
  assert.strictEqual(noneCopy.kicker, '推荐其他');
  assert.ok(noneCopy.title.indexOf('没有完全匹配') >= 0);
  assert.ok(!/已按/.test(noneCopy.summaryHtml), '无精确匹配时不能写成已按条件匹配');

  const exactCopy = card.matchCopy('exact', { grade: '初二', subject: '数学', style: '引导启发' });
  assert.ok(/已按/.test(exactCopy.summaryHtml));
  assert.strictEqual(card.matchCopy('casual', {}).kicker, '随便看看');

  const passed = card.render(card.buildModel(mentors[0]), { variant: 'live' });
  assert.ok(passed.includes('学历认证学伴'));
  assert.ok(passed.includes('data-role-type="学历认证学伴"'));
  assert.ok(!/xh-ccard-stamp[^>]*>学历认证学伴/.test(passed), '学历认证学伴不是核验章');
  assert.ok(passed.includes('已通过'));
  assert.ok(passed.includes('资金托管'));
  assert.ok(passed.includes('李老师'));
  assert.ok(passed.includes('四川大学'));
  assert.ok(passed.includes('初中数学'));
  assert.ok(passed.includes('引导启发解题'));
  assert.ok(passed.includes('¥120'));
  assert.ok(!passed.includes('合规实名认证'));
  assert.ok(!passed.includes('5.0（新入驻）'));
  assert.ok(!passed.includes('在读大学生'));

  const pending = card.render(card.buildModel({
    realName: '王小',
    university: '西南交通大学',
    subjects: ['小学英语'],
    styles: ['耐心督学陪读'],
    hourlyRate: 90,
    status: 'pending',
    chsiStatus: '待核验'
  }), { variant: 'feature' });
  assert.ok(pending.includes('实名待审'));
  assert.ok(pending.includes('王老师'));
  assert.ok(!/>已通过</.test(pending));
  assert.strictEqual((pending.match(/资金托管/g) || []).length, 1);

  const indexHtml = read('index.html');
  const landing = read('js/select-landing.js');
  const dash = read('parent_dashboard.html');
  assert.ok(indexHtml.includes('js/companion-card.js'));
  assert.ok(indexHtml.includes('function updateLiveCard'));
  assert.ok(indexHtml.includes('XinghuoCompanionCard.buildModel'));
  assert.ok(indexHtml.includes('XinghuoCompanionCard.render'));
  assert.ok(indexHtml.includes('id="liveCardPanel"'));
  assert.ok(indexHtml.includes('开始选择学伴'));
  assert.ok(indexHtml.includes('先随便看看'));
  assert.ok(indexHtml.includes('我是学长学姐'));
  assert.ok(indexHtml.includes('填写入库申请'));
  assert.ok(indexHtml.includes('enterAsMentor'));
  assert.ok(indexHtml.includes('login.html?role=mentor'));
  assert.ok(landing.includes('parent_register.html'));
  assert.ok(landing.includes('login.html?role=parent'));
  assert.ok(landing.includes('parent_dashboard.html?book='));
  assert.ok(landing.includes('fetchPublicMentorsForBrowse'));
  assert.ok(!landing.includes('L 同学'));
  assert.ok(!indexHtml.includes('翻牌'));
  assert.ok(!indexHtml.includes('这是预览'));
  assert.ok(!indexHtml.includes('预览页不进入'));
  assert.ok(!indexHtml.includes('合规实名认证'));
  assert.ok(!indexHtml.includes('5.0（新入驻）'));
  assert.ok(!indexHtml.includes('在读大学生'));
  const footer = indexHtml.slice(indexHtml.lastIndexOf('<footer'));
  assert.ok(footer.includes('蜀ICP备2026058908号-2'));
  assert.ok(!footer.includes('教育部'));
  assert.ok(!footer.includes('本页为方案预览'));
  assert.ok(indexHtml.includes('assets/homepage/tutor-student-hero.jpg'));
  assert.ok(indexHtml.includes('assets/brand/spark-logo-forest-noface-192.png'));
  assert.ok(indexHtml.includes('shouldOpenMentorOnboard'));
  assert.ok(dash.includes('openBookingFromLandingQuery'));
  assert.ok(dash.includes("get('book')"));

  console.log('✓ 选择学伴落地 / 学伴卡模版断言通过');
}

main();
