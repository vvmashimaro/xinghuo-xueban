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
  assert.strictEqual(card.schoolLine({
    university: '西南交通大学',
    chsiMajor: '外国语学院英语专业 · 英语专业四级优秀',
    subjects: ['小学英语']
  }), '西南交通大学 · 小学英语');
  assert.strictEqual(card.schoolLine({
    university: '四川大学',
    major: '物理学',
    subjects: ['初中数学']
  }), '四川大学 · 物理学');
  assert.strictEqual(card.maskName('张若愚'), '张同学');
  assert.strictEqual(card.maskName('欧阳娜娜'), '欧阳同学');
  assert.strictEqual(card.maskName('李老师'), '李同学');
  assert.strictEqual(card.displayName({ maskedName: '李老师', realName: '李明' }), '李同学');

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
  assert.ok(passed.includes('李同学'));
  assert.ok(!passed.includes('李老师'));
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
  assert.ok(pending.includes('王同学'));
  assert.ok(!pending.includes('老师'));
  assert.ok(!/>已通过</.test(pending));
  assert.strictEqual((pending.match(/资金托管/g) || []).length, 1);

  const display = card.normalizeDisplayRoster([{
    id: 'swap-sample',
    realName: '周衡',
    university: '四川大学',
    major: '物理学',
    degree: '本科在读 (大二)',
    subjects: ['初中数学', '高中数学', '小学数学', '奥数'],
    styles: ['引导启发', '拆题耐心', '跟读带练', '应试提分'],
    hourlyRate: 128,
    scoreHighlight: '只在有内容时展示',
    status: 'approved',
    chsiStatus: '有效 (在籍)',
    rating: '5.0'
  }])[0];
  assert.strictEqual(display.status, 'unaudited');
  assert.strictEqual(display.displayOnly, true);
  assert.strictEqual(display.chsiStatus, undefined);
  assert.deepStrictEqual(card.verifyStamp(display), { label: '未审核', tone: 'warn' });
  const displayHtml = card.render(card.buildModel(display), { variant: 'feature' });
  assert.ok(displayHtml.includes('未审核'));
  assert.ok(displayHtml.includes('周同学'));
  assert.ok(displayHtml.includes('四川大学 · 物理学'));
  assert.ok(displayHtml.includes('只在有内容时展示'));
  assert.ok(displayHtml.includes('¥128'));
  assert.ok(displayHtml.includes('data-role-type="学历认证学伴"'));
  assert.ok(!/xh-ccard-stamp[^>]*>学历认证学伴/.test(displayHtml));
  assert.ok(!displayHtml.includes('奥数'));
  assert.ok(!displayHtml.includes('应试提分'));
  assert.ok(!displayHtml.includes('已通过'));
  assert.ok(!displayHtml.includes('已核验'));
  assert.ok(!displayHtml.includes('已认证'));
  assert.ok(!displayHtml.includes('5.0'));
  assert.ok(!displayHtml.includes('老师'));
  assert.ok(!displayHtml.includes('本科在读'));
  const rowHtml = card.render(card.buildModel(display), { variant: 'row' });
  assert.ok(rowHtml.includes('未审核'));
  assert.ok(rowHtml.includes('学历认证学伴'));
  const quiet = card.render(card.buildModel(card.normalizeDisplayRoster([{
    id: 'no-highlight',
    realName: '周衡',
    university: '四川大学',
    major: '物理学',
    hourlyRate: 100,
    scoreHighlight: '   '
  }])[0]), { variant: 'feature' });
  assert.ok(!quiet.includes('xh-ccard-highlight'));
  const emptyCasual = card.filterCompanions([], { casual: true });
  assert.strictEqual(emptyCasual.mode, 'casual-empty');
  const emptyCopy = card.matchCopy('casual-empty', {});
  assert.strictEqual(emptyCopy.kicker, '随便看看');
  assert.ok(!/已按/.test(emptyCopy.summaryHtml));

  const roster = require(path.join(ROOT, 'js/browse-display-roster.js'));
  const rosterSrc = read('js/browse-display-roster.js');
  assert.ok(Array.isArray(roster));
  assert.strictEqual(roster.length, 10);
  assert.deepStrictEqual(roster.map(function (item) { return item.maskedName; }), [
    '陈同学', '周同学', '王同学', '吴同学', '李同学', '赵同学', '刘同学', '黄同学', '孙同学', '郑同学'
  ]);
  assert.deepStrictEqual(roster.map(function (item) { return item.university + ' · ' + item.major; }), [
    '电子科技大学 · 物理学',
    '西南交通大学 · 英语',
    '四川大学 · 汉语言文学',
    '电子科技大学 · 数学与应用数学',
    '四川大学 · 数学与应用数学',
    '西华大学 · 小学教育',
    '电子科技大学 · 数学',
    '西南大学 · 生物科学',
    '四川大学 · 汉语言文学',
    '电子科技大学 · 计算机科学与技术'
  ]);
  assert.deepStrictEqual(roster.map(function (item) { return item.priceBand; }), [
    '¥150–200/时', '¥90–130/时', '¥100–140/时', '¥160–220/时', '¥120–160/时',
    '¥70–100/时', '¥180–240/时', '¥130–180/时', '¥130–170/时', '¥150–200/时'
  ]);
  assert.deepStrictEqual(roster.map(function (item) { return item.stageLabel; }), [
    '高一–高三', '小学高年级、初一、初二', '小学高年级、初一、初二', '高一–高三', '初一–初三',
    '一至六年级', '考研', '高一–高三', '高一–高三', '初中、高中'
  ]);
  assert.strictEqual(roster[5].scoreHighlight, undefined);
  assert.strictEqual(roster[0].scoreHighlight, '高考物理 142 分');
  assert.strictEqual(roster[6].scoreHighlight, '考研数学一 142 分');
  assert.strictEqual(roster[9].scoreHighlight, 'CSP-J 一等奖');
  assert.ok(!/已通过|已认证|已核验|5\.0|老师/.test(rosterSrc));
  const shown = card.normalizeDisplayRoster(roster);
  shown.forEach(function (item) {
    assert.strictEqual(item.status, 'unaudited');
    assert.strictEqual(item.displayOnly, true);
    assert.strictEqual(item.chsiStatus, undefined);
    const html = card.render(card.buildModel(item), { variant: 'feature' });
    assert.ok(html.includes('未审核'));
    assert.ok(html.includes('学历认证学伴'));
    assert.ok(html.includes(item.priceBand.replace('/时', '')));
    assert.ok(html.includes(item.stageLabel));
    assert.ok(!html.includes('已通过'));
    assert.ok(!html.includes('已认证'));
    assert.ok(!html.includes('已核验'));
    assert.ok(!html.includes('5.0'));
    assert.ok(!/>已通过</.test(html));
  });
  assert.ok(!card.render(card.buildModel(shown[5]), { variant: 'feature' }).includes('xh-ccard-highlight'));
  function ids(criteria) {
    return card.filterCompanions(shown, Object.assign({ casual: true }, criteria)).list.map(function (item) { return item.id; });
  }
  assert.deepStrictEqual(ids({}), shown.map(function (item) { return item.id; }));
  assert.deepStrictEqual(ids({ grade: '小学低年级' }), ['browse-06']);
  assert.deepStrictEqual(ids({ grade: '小学' }), ['browse-02', 'browse-03', 'browse-06']);
  assert.deepStrictEqual(ids({ grade: '考研' }), ['browse-07']);
  assert.deepStrictEqual(ids({ subject: '生物' }), ['browse-08']);
  assert.deepStrictEqual(ids({ subject: '艺考文化课' }), ['browse-09']);
  assert.deepStrictEqual(ids({ subject: '编程/信息学' }), ['browse-10']);
  assert.deepStrictEqual(ids({ grade: '高一', subject: '物理', style: '拆题耐心' }), ['browse-01']);
  assert.deepStrictEqual(ids({ grade: '初三', subject: '数学', style: '引导启发' }), ['browse-05']);
  assert.deepStrictEqual(ids({ style: '跟读带练' }), ['browse-02']);
  assert.deepStrictEqual(ids({ style: '项目带练' }), ['browse-10']);
  const noneCasual = card.filterCompanions(shown, { casual: true, subject: '化学' });
  assert.strictEqual(noneCasual.mode, 'casual-none');
  assert.strictEqual(noneCasual.list.length, 0);
  assert.ok(!/已按/.test(card.matchCopy(noneCasual.mode, { subject: '化学' }).summaryHtml));
  assert.ok(read('docs/previews/browse-unaudited-roster.html').includes('browse-display-roster.js'));

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
  assert.ok(indexHtml.includes('js/browse-display-roster.js'));
  assert.ok(landing.includes('XINGHUO_BROWSE_DISPLAY_ROSTER'));
  assert.ok(landing.includes('normalizeDisplayRoster'));
  const casualFn = landing.slice(landing.indexOf('async function startCasual'), landing.indexOf('async function finishIntake'));
  assert.ok(casualFn.includes('displayRoster'));
  assert.ok(landing.includes("var SUBJECTS = ['语文', '数学', '英语', '物理', '化学']"));
  assert.ok(landing.includes('编程/信息学'));
  assert.ok(landing.includes('艺考文化课'));
  assert.ok(landing.includes('BROWSE_GRADES'));
  assert.ok(landing.includes("grade: '考研'") || landing.includes("'考研'"));
  assert.ok(!casualFn.includes('fetchPublicMentorsForBrowse'));
  assert.ok(!casualFn.includes('getApprovedMentors'));
  const cont = landing.slice(landing.indexOf('function continueWith'), landing.indexOf('function optionButtons'));
  const guardAt = cont.indexOf('isDisplayOnly');
  const bookAt = cont.indexOf("parent_dashboard.html?book=");
  assert.ok(guardAt >= 0 && bookAt > guardAt, '未审核展示卡不能走进预约');
  assert.ok(cont.includes('尚未审核，暂不能预约'));
  const server = read('_platform/server/src/index.js');
  const db = read('_platform/server/src/db.js');
  assert.ok(server.includes("surname + '老师'"));
  assert.ok(!server.includes('browse-display-roster'));
  assert.ok(!server.includes('XINGHUO_BROWSE_DISPLAY_ROSTER'));
  assert.ok(!db.includes('XINGHUO_BROWSE_DISPLAY_ROSTER'));
  assert.ok(!db.includes('browse-display-roster'));
  assert.ok(dash.includes('openBookingFromLandingQuery'));
  assert.ok(dash.includes("get('book')"));

  console.log('✓ 选择学伴落地 / 学伴卡模版断言通过');
}

main();
