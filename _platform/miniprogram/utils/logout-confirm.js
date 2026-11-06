/**
 * 用户主动「退出登录」：二次确认后再清会话并进入登录页。
 * 程序化登出（如 token 失效）请直接调用 Storage.logout / clearSession，勿走本模块。
 */
const Storage = require('./storage');

const LOGOUT_TITLE = '确认退出该账号？';
const LOGOUT_CONTENT = '退出后需要重新登录';
const CONFIRM_TEXT = '退出登录';
const CANCEL_TEXT = '取消';
const LOGIN_URL = '/pages/login/login';

/**
 * @param {{ onBeforeNavigate?: () => void }} [options]
 * @returns {Promise<{ cancelled?: boolean, success?: boolean }>}
 */
function confirmUserLogout(options) {
  const onBeforeNavigate = options && typeof options.onBeforeNavigate === 'function'
    ? options.onBeforeNavigate
    : null;

  return new Promise((resolve) => {
    wx.showModal({
      title: LOGOUT_TITLE,
      content: LOGOUT_CONTENT,
      confirmText: CONFIRM_TEXT,
      cancelText: CANCEL_TEXT,
      success(res) {
        if (!res.confirm) {
          resolve({ cancelled: true });
          return;
        }
        (async () => {
          if (onBeforeNavigate) {
            try { onBeforeNavigate(); } catch (e) { /* ignore */ }
          }
          await Storage.logout();
          Storage.clearSession();
          wx.reLaunch({ url: LOGIN_URL });
          resolve({ cancelled: false, success: true });
        })();
      },
      fail() {
        resolve({ cancelled: true });
      }
    });
  });
}

module.exports = {
  confirmUserLogout,
  LOGOUT_TITLE,
  LOGOUT_CONTENT,
  CONFIRM_TEXT,
  CANCEL_TEXT
};
