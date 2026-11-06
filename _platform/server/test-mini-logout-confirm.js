#!/usr/bin/env node
'use strict';

/**
 * 小程序「退出登录」：确认框必须能弹出，确认后即使登出接口卡住也要回到登录页。
 * 不启服务，只读源码并在桩 wx 上跑 logout-confirm。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MINI = path.join(ROOT, '_platform/miniprogram');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function assertStatic() {
  const confirmSrc = read('_platform/miniprogram/utils/logout-confirm.js');
  assert.ok(confirmSrc.includes("const CONFIRM_TEXT = '退出';"), '确认按钮缩短为「退出」');
  assert.ok(!/CONFIRM_TEXT\s*=\s*'退出登录'/.test(confirmSrc), '确认按钮不能再是 4 字「退出登录」');
  assert.ok(confirmSrc.includes('onBeforeShow'), '弹出前钩子');
  assert.ok(confirmSrc.includes('LOGOUT_API_TIMEOUT_MS = 2500'), '登出请求 2.5s 超时');
  assert.ok(confirmSrc.includes('clearSession'), '超时后仍 clearSession');
  assert.ok(confirmSrc.includes('reLaunch'), '超时后仍 reLaunch');
  assert.ok(confirmSrc.includes('showToast'), 'showModal 失败要 toast');
  assert.ok(confirmSrc.includes('clearAuthToken'), '超时后仍清 token，避免登录页自动进入');

  const storageSrc = read('_platform/miniprogram/utils/storage.js');
  assert.ok(storageSrc.includes('timeoutMs'), '登出请求可超时中止');
  assert.ok(storageSrc.includes('tokenAtStart'), '迟到的 logout 不能清掉新令牌');

  ['parent-dashboard', 'mentor-dashboard'].forEach((page) => {
    const js = read(`_platform/miniprogram/pages/${page}/${page}.js`);
    const start = js.indexOf('goLogin()');
    assert.ok(start >= 0, page + ' goLogin');
    const body = js.slice(start, start + 420);
    const closeAt = body.indexOf('this.closeSettingsDrawer()');
    const confirmAt = body.indexOf('confirmUserLogout');
    assert.ok(closeAt >= 0 && confirmAt > closeAt, page + ' 先关抽屉再确认');
    assert.ok(body.includes('onBeforeShow'), page + ' onBeforeShow');
    assert.ok(body.includes('onBeforeNavigate'), page + ' onBeforeNavigate');
  });

  const logoutRows = [];
  walk(MINI, []).filter((file) => file.endsWith('.wxml')).forEach((file) => {
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('退出登录')) return;
    logoutRows.push(path.relative(ROOT, file));
    assert.ok(
      /catchtap="goLogin"[\s\S]{0,160}退出登录/.test(src),
      file + ' 退出登录行要用 catchtap'
    );
    assert.ok(
      !/bindtap="goLogin"[\s\S]{0,160}退出登录/.test(src),
      file + ' 退出登录行不能再用 bindtap'
    );
  });
  assert.deepStrictEqual(logoutRows.sort(), [
    '_platform/miniprogram/pages/mentor-dashboard/mentor-dashboard.wxml',
    '_platform/miniprogram/pages/parent-dashboard/parent-dashboard.wxml'
  ]);
}

function installWx() {
  const store = {};
  const state = {
    modals: [],
    toasts: [],
    relaunches: [],
    aborts: 0
  };
  global.getCurrentPages = () => [];
  global.wx = {
    getStorageSync(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : '';
    },
    setStorageSync(key, value) { store[key] = value; },
    removeStorageSync(key) { delete store[key]; },
    showToast(opts) { state.toasts.push(opts); },
    showModal(opts) { state.modals.push(opts); },
    reLaunch(opts) { state.relaunches.push(opts); },
    request() { return { abort() { state.aborts += 1; } }; },
    nextTick(fn) { setTimeout(fn, 0); }
  };
  return { store, state };
}

function flush(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertBehavior() {
  const { store, state } = installWx();
  const Storage = require(path.join(MINI, 'utils/storage.js'));
  const {
    confirmUserLogout,
    CONFIRM_TEXT,
    CANCEL_TEXT,
    LOGOUT_API_TIMEOUT_MS,
    MODAL_FAIL_TOAST
  } = require(path.join(MINI, 'utils/logout-confirm.js'));

  assert.strictEqual(CONFIRM_TEXT, '退出');
  assert.ok(Array.from(CONFIRM_TEXT).length < 4);
  assert.ok(Array.from(CANCEL_TEXT).length < 4);

  const order = [];
  const cancelledP = confirmUserLogout({
    onBeforeShow() { order.push('before'); }
  });
  order.push('called');
  await flush(20);
  assert.deepStrictEqual(order, ['before', 'called']);
  assert.strictEqual(state.modals.length, 1);
  assert.strictEqual(state.modals[0].confirmText, '退出');
  assert.strictEqual(state.modals[0].cancelText, '取消');
  state.modals[0].success({ confirm: false, cancel: true });
  state.modals[0].complete({ errMsg: 'showModal:ok' });
  assert.deepStrictEqual(await cancelledP, { cancelled: true });
  assert.strictEqual(state.relaunches.length, 0);

  const failedP = confirmUserLogout();
  await flush(20);
  const failedModal = state.modals[state.modals.length - 1];
  failedModal.fail({ errMsg: 'showModal:fail confirmText length should not larger than 4' });
  failedModal.complete({ errMsg: 'showModal:fail confirmText length should not larger than 4' });
  const failed = await failedP;
  assert.strictEqual(failed.modalFailed, true);
  assert.strictEqual(failed.cancelled, true);
  assert.ok(state.toasts.some((t) => t && t.title === MODAL_FAIL_TOAST), '确认框失败有 toast');
  assert.strictEqual(state.relaunches.length, 0);

  const origLogout = Storage.logout;
  let logoutCalls = 0;
  Storage.logout = () => {
    logoutCalls += 1;
    return new Promise(() => {});
  };
  store.xh_session_v1 = { role: 'parent' };
  store.xh_auth_token_v1 = 'tok-old';
  const started = Date.now();
  const hangP = confirmUserLogout();
  await flush(20);
  const hangModal = state.modals[state.modals.length - 1];
  hangModal.success({ confirm: true, cancel: false });
  hangModal.complete({ errMsg: 'showModal:ok' });
  const hangResult = await hangP;
  const elapsed = Date.now() - started;
  assert.strictEqual(hangResult.success, true);
  assert.strictEqual(logoutCalls, 1);
  assert.ok(!Object.prototype.hasOwnProperty.call(store, 'xh_session_v1'), 'session 已清');
  assert.strictEqual(store.xh_auth_token_v1, null);
  assert.strictEqual(state.relaunches[state.relaunches.length - 1].url, '/pages/login/login');
  assert.ok(elapsed >= LOGOUT_API_TIMEOUT_MS - 80, 'elapsed ' + elapsed);
  assert.ok(elapsed < LOGOUT_API_TIMEOUT_MS + 1500, 'elapsed ' + elapsed);
  Storage.logout = origLogout;

  let fastLogout = 0;
  Storage.logout = () => {
    fastLogout += 1;
    return Promise.resolve();
  };
  const fastStarted = Date.now();
  const fastP = confirmUserLogout();
  await flush(20);
  const fastModal = state.modals[state.modals.length - 1];
  fastModal.success({ confirm: true });
  fastModal.complete({ errMsg: 'showModal:ok' });
  const fastResult = await fastP;
  assert.strictEqual(fastResult.success, true);
  assert.strictEqual(fastLogout, 1);
  assert.ok(Date.now() - fastStarted < 1000);
  Storage.logout = origLogout;

  state.aborts = 0;
  global.wx.request = (opts) => ({
    abort() {
      state.aborts += 1;
      if (typeof opts.fail === 'function') opts.fail({ errMsg: 'request:fail abort' });
      if (typeof opts.complete === 'function') opts.complete();
    }
  });
  Storage.setAuthToken('tok-hang');
  const abortStarted = Date.now();
  const warn = console.warn;
  console.warn = () => {};
  try {
    await Storage.logout({ timeoutMs: 40 });
  } finally {
    console.warn = warn;
  }
  assert.ok(state.aborts >= 1, '超时会 abort 登出请求');
  assert.strictEqual(Storage.getAuthToken(), null);
  assert.ok(Date.now() - abortStarted < 500);

  global.wx.request = (opts) => {
    setTimeout(() => {
      Storage.setAuthToken('tok-new');
      opts.success({ statusCode: 200, data: { ok: true } });
      if (typeof opts.complete === 'function') opts.complete();
    }, 30);
    return { abort() {} };
  };
  Storage.setAuthToken('tok-old');
  await Storage.logout({ timeoutMs: 1000 });
  assert.strictEqual(Storage.getAuthToken(), 'tok-new');
}

async function main() {
  assertStatic();
  await assertBehavior();
  console.log('✓ 小程序退出登录确认（短按钮文案 / 先关抽屉 / 超时仍回登录页）');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
