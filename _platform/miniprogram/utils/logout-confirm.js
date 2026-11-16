/**
 * 用户主动「退出登录」：二次确认后再清会话并进入登录页。
 * 程序化登出（如 token 失效）请直接调用 Storage.logout / clearSession，勿走本模块。
 *
 * 部分微信基础库对 confirmText / cancelText「恰好 4 个汉字」会让 showModal 直接 fail
 * （确认框不出现，success 不回调）。按钮文案必须短于 4 个字。
 * 设置抽屉须在 showModal 之前关掉，否则抽屉仍盖在页面上时确认框弹不出来。
 */
const Storage = require('./storage');
const { showToast } = require('./toast');

const LOGOUT_TITLE = '确认退出该账号？';
const LOGOUT_CONTENT = '退出后需要重新登录';
const CONFIRM_TEXT = '退出';
const CANCEL_TEXT = '取消';
const LOGIN_URL = '/pages/login/login';
const LOGOUT_API_TIMEOUT_MS = 2500;
const MODAL_FAIL_TOAST = '无法弹出确认，请重试';

/**
 * showModal 按钮文案上限是 4，但 4 个汉字在部分基础库会被判失败。
 * @param {string} text
 * @param {string} fallback
 */
function modalButtonText(text, fallback) {
  const value = String(text || '');
  if (Array.from(value).length === 0 || Array.from(value).length >= 4) return fallback;
  return value;
}

function withTimeout(work, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, ms);
    let pending;
    try {
      pending = work();
    } catch (e) {
      pending = Promise.resolve();
    }
    Promise.resolve(pending).then(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    );
  });
}

function afterDrawerClose(fn) {
  if (typeof wx !== 'undefined' && typeof wx.nextTick === 'function') {
    wx.nextTick(fn);
    return;
  }
  setTimeout(fn, 0);
}

function leaveToLogin(onBeforeNavigate) {
  if (onBeforeNavigate) {
    try { onBeforeNavigate(); } catch (e) { /* ignore */ }
  }
  const logout = () => {
    if (!Storage || typeof Storage.logout !== 'function') return Promise.resolve();
    return Storage.logout({ timeoutMs: LOGOUT_API_TIMEOUT_MS });
  };
  return withTimeout(logout, LOGOUT_API_TIMEOUT_MS).then(() => {
    try {
      if (Storage && typeof Storage.clearAuthToken === 'function') Storage.clearAuthToken();
    } catch (e) { /* ignore */ }
    try {
      if (Storage && typeof Storage.clearSession === 'function') Storage.clearSession();
    } catch (e) { /* ignore */ }
    try {
      wx.reLaunch({ url: LOGIN_URL });
    } catch (e) { /* ignore */ }
  });
}

/**
 * @param {{ onBeforeShow?: () => void, onBeforeNavigate?: () => void }} [options]
 * onBeforeShow：弹出确认框之前（关掉设置抽屉）。
 * onBeforeNavigate：用户确认退出之后、清会话之前。
 * @returns {Promise<{ cancelled?: boolean, success?: boolean, modalFailed?: boolean }>}
 */
function confirmUserLogout(options) {
  const opts = options || {};
  const onBeforeNavigate = typeof opts.onBeforeNavigate === 'function' ? opts.onBeforeNavigate : null;
  const onBeforeShow = typeof opts.onBeforeShow === 'function' ? opts.onBeforeShow : null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const failModal = () => {
      if (settled) return;
      settled = true;
      try { showToast(MODAL_FAIL_TOAST, 'warning'); } catch (e) { /* ignore */ }
      resolve({ cancelled: true, modalFailed: true });
    };

    if (onBeforeShow) {
      try { onBeforeShow(); } catch (e) { /* ignore */ }
    }

    afterDrawerClose(() => {
      if (settled) return;
      if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') {
        failModal();
        return;
      }
      try {
        wx.showModal({
          title: LOGOUT_TITLE,
          content: LOGOUT_CONTENT,
          confirmText: modalButtonText(CONFIRM_TEXT, '退出'),
          cancelText: modalButtonText(CANCEL_TEXT, '取消'),
          success(res) {
            if (settled) return;
            if (!res || !res.confirm) {
              finish({ cancelled: true });
              return;
            }
            settled = true;
            leaveToLogin(onBeforeNavigate).then(() => {
              resolve({ cancelled: false, success: true });
            });
          },
          fail() {
            failModal();
          },
          complete(res) {
            const errMsg = res && res.errMsg ? String(res.errMsg) : '';
            if (errMsg.indexOf(':fail') !== -1) failModal();
          }
        });
      } catch (e) {
        failModal();
      }
    });
  });
}

module.exports = {
  confirmUserLogout,
  LOGOUT_TITLE,
  LOGOUT_CONTENT,
  CONFIRM_TEXT,
  CANCEL_TEXT,
  LOGOUT_API_TIMEOUT_MS,
  MODAL_FAIL_TOAST
};
