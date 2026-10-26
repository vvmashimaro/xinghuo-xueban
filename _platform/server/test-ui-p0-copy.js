#!/usr/bin/env node
'use strict';

/**
 * 静态断言：UI P0 切片（文案 / 样式止血 / 令牌文件）
 * 不启服务，只读仓库文件。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function main() {
  const parentDash = read('parent_dashboard.html');
  const indexHtml = read('index.html');
  const miniJs = read('_platform/miniprogram/pages/parent-dashboard/parent-dashboard.js');
  const miniWxml = read('_platform/miniprogram/pages/parent-dashboard/parent-dashboard.wxml');
  const onboardWxml = read('_platform/miniprogram/pages/mentor-onboard/mentor-onboard.wxml');
  const storageWeb = read('js/storage-service.js');
  const storageMini = read('_platform/miniprogram/utils/storage.js');
  const tokens = read('css/tokens.css');
  const tw = read('js/tailwind-config.js');
  const appWxss = read('_platform/miniprogram/app.wxss');
  const adminHtml = read('admin-saas/index.html');

  assert.ok(tokens.includes('--font-sans'), 'tokens 含中文字体栈');
  assert.ok(tokens.includes('--color-danger: #e11d48'), 'danger 统一 rose-600');
  assert.ok(tw.includes('PingFang SC'), 'tailwind-config 含中文字体');

  [
    'index.html',
    'login.html',
    'mentor_dashboard.html',
    'parent_dashboard.html',
    'parent_register.html',
    'assessment.html'
  ].forEach((f) => {
    const src = read(f);
    assert.ok(!/label:has\(>\s*input\[type="radio"\]\)\s*span/.test(src), f + ' 应移除 radio span !important');
    assert.ok(!/label:has\(>\s*input\[type="checkbox"\]\)\s*span/.test(src), f + ' 应移除 checkbox span !important');
    assert.ok(src.includes('js/tailwind-config.js'), f + ' 引用共享 tailwind-config');
    assert.ok(src.includes('css/tokens.css'), f + ' 引用 tokens.css');
  });
  assert.ok(adminHtml.includes('../js/tailwind-config.js'), 'admin 引用共享 tailwind-config');
  assert.ok(adminHtml.includes('../css/tokens.css'), 'admin 引用 tokens.css');

  assert.ok(indexHtml.includes('xh-consent-card'), '导师入驻含 consent card class');
  assert.ok(/xh-consent-emph[^>]*>脱敏传输与加密存储您的相关信息/.test(indexHtml), '目标短语应加粗突出');
  assert.ok(onboardWxml.includes('脱敏传输与加密存储您的相关信息'), '小程序入驻含同等授权说明');

  assert.ok(parentDash.includes('约课已撤销'), 'cancelled 文案');
  assert.ok(parentDash.includes('已解冻退回'), 'declined 资金文案');
  assert.ok(parentDash.includes('待确认档期'), 'pending_accept 子课次徽章');
  assert.ok(parentDash.includes("b.status === 'accepted'"), '请假仅 accepted');
  assert.ok(!parentDash.includes('id="paymentMethodModal"'), '已移除独立支付方式弹窗');
  assert.ok(parentDash.includes('userDeferred') || parentDash.includes('wechatPayWaitAborted'), '扫码关闭可中断等待');
  assert.ok(parentDash.includes('parentBookingCtaLabel'), '约课 CTA 随仓位开关切换');
  assert.ok(parentDash.includes('首次试课'), '详情/抽屉对齐试课文案');

  const durIdx = parentDash.indexOf('id="bookingDurationPanel"');
  const dateIdx = parentDash.indexOf('id="oneOffDatePanel"');
  assert.ok(durIdx > 0 && dateIdx > durIdx, '辅导时长应排在日期时段之前');

  assert.ok(storageWeb.includes('shouldAbort'), 'Web waitForPaymentConfirmed 支持中止');
  assert.ok(storageMini.includes('shouldAbort'), '小程序 waitForPaymentConfirmed 支持中止');

  assert.ok(miniJs.includes("bookingFilter === 'cancelled'") || miniWxml.includes("data-v=\"cancelled\""), '小程序可筛选已取消');
  assert.ok(miniJs.includes("b.status === 'accepted'"), '小程序请假仅已接单');
  assert.ok(miniWxml.includes('item.fundReason'), '小程序列表展示资金说明');
  assert.ok(miniWxml.includes('item.amountCaption'), '小程序列表展示金额说明');

  const hoursHeading = miniWxml.indexOf('单次辅导时长');
  const dateHeading = miniWxml.indexOf('选择日期与时段');
  assert.ok(hoursHeading > 0 && dateHeading > hoursHeading, '小程序时长在日期前');
  assert.ok(miniWxml.includes("consoleSection==='discover'"), '匹配横幅仅查找导师全量展示');

  assert.ok(/--color-danger:\s*#e11d48/.test(appWxss), '小程序 danger 为 rose');
  assert.ok(appWxss.includes('PingFang'), '小程序 page 声明中文字体');

  const ctaMatches = parentDash.match(/约仓试听/g) || [];
  assert.ok(ctaMatches.length <= 1, '约仓试听只应出现在仓位开启分支');
  assert.ok(parentDash.includes('isSmartWarehouseEnabled'), '仓位文案走开关');

  const pulseGif = fs.readFileSync(path.join(ROOT, 'assets/loading/xinghuo-loading-pulse.gif'));
  assert.strictEqual(pulseGif.slice(0, 6).toString('ascii'), 'GIF89a', 'Web pulse GIF 应为 GIF89a');
  const svg = read('assets/loading/xinghuo-loading.svg');
  assert.ok(svg.includes('#0d9488'), 'loading SVG 使用 teal #0d9488');
  assert.ok(svg.includes('@keyframes pulse'), 'loading SVG 含 CSS pulse');
  assert.ok(read('assets/loading/xinghuo-loading-overlay.css').includes('#xhLoading'), 'overlay CSS 存在');
  const xhLoading = read('js/xh-loading.js');
  assert.ok(
    xhLoading.includes('spark-mascot-loader.svg') || xhLoading.includes('xinghuo-loading.svg'),
    'Web overlay 使用星火加载 SVG'
  );
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/loading/spark-mascot-loader.svg')), 'spark mascot loader SVG 存在');
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/brand/spark-mascot-96.png')), 'spark mascot PNG 存在');
  assert.ok(xhLoading.includes('/api/pay/wechat/sync'), 'Web overlay 跳过支付轮询');
  assert.ok(xhLoading.includes('/api/feature-flags'), 'Web overlay 跳过 feature-flags');
  [
    'index.html',
    'login.html',
    'mentor_dashboard.html',
    'parent_dashboard.html',
    'parent_register.html',
    'assessment.html'
  ].forEach((f) => {
    assert.ok(read(f).includes('js/xh-loading.js'), f + ' 引入 xh-loading');
  });
  assert.ok(adminHtml.includes('../js/xh-loading.js'), 'admin 引入 xh-loading');

  const miniGif = fs.readFileSync(path.join(ROOT, '_platform/miniprogram/assets/loading/xinghuo-loading-pulse.gif'));
  assert.strictEqual(miniGif.slice(0, 6).toString('ascii'), 'GIF89a', '小程序 pulse GIF 应为 GIF89a');
  assert.ok(read('_platform/miniprogram/app.json').includes('xh-loading'), '小程序全局注册 loading 组件');
  assert.ok(miniWxml.includes('<xh-loading'), '家长工作台含 loading 组件');
  assert.ok(storageMini.includes("require('./loading')"), '小程序 _request 接入 loading');
  const XhLoadingMini = require('../miniprogram/utils/loading.js');
  assert.strictEqual(XhLoadingMini.shouldTrack('/api/bookings'), true);
  assert.strictEqual(XhLoadingMini.shouldTrack('/api/pay/wechat/sync'), false);
  assert.strictEqual(XhLoadingMini.shouldTrack('/api/feature-flags'), false);
  assert.strictEqual(XhLoadingMini.shouldTrack('/api/health'), false);

  console.log('✓ UI P0 静态文案 / 令牌断言通过');
}

main();
