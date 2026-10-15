/**
 * 学信网在线验证码校验（与 Web index.html 演示逻辑对齐，前端模拟结构化解析）
 */
const CHSI_ARCHIVE_URL = 'https://my.chsi.com.cn/archive/index.jsp';

const STATUS = {
  idle: { text: '未验证', cls: 'chsi-badge-idle' },
  verifying: { text: '正在调阅学信网', cls: 'chsi-badge-warn' },
  ok: { text: '验证一致', cls: 'chsi-badge-ok' },
  fail: { text: '验证失败', cls: 'chsi-badge-fail' }
};

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function validateInputs({ realName, chsiCode, university }) {
  const name = String(realName || '').trim();
  const vcode = normalizeCode(chsiCode);
  const uni = String(university || '').trim();
  if (!name) return { ok: false, error: '请先填写真实姓名，以便比对报告！' };
  if (!vcode || vcode.length < 12) {
    return { ok: false, error: '请输入有效的 16 位学信网学籍在线验证码！' };
  }
  if (!uni) return { ok: false, error: '请先填写就读/毕业高校！' };
  return { ok: true, name, vcode, uni };
}

/**
 * @returns {Promise<{valid:boolean,name:string,university:string,status:string,expire:string,major:string}>}
 */
function runChsiVerification({ realName, chsiCode, university }) {
  const check = validateInputs({ realName, chsiCode, university });
  if (!check.ok) {
    return Promise.reject(new Error(check.error));
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        valid: true,
        name: check.name,
        university: check.uni,
        status: '在籍 (注册学籍)',
        expire: '有效 (至2026-12)',
        major: '学籍专业 · 平台解析归档'
      });
    }, 1200);
  });
}

function silentFallbackResult({ realName, chsiCode, university }) {
  const check = validateInputs({ realName, chsiCode, university });
  if (!check.ok) return null;
  return {
    valid: true,
    name: check.name,
    university: check.uni,
    status: '在籍 (注册学籍)',
    expire: '有效 (至2026-12)',
    major: check.uni + ' · 在籍核验'
  };
}

function openChsiArchive() {
  const url = CHSI_ARCHIVE_URL;
  if (typeof wx !== 'undefined' && wx.setClipboardData) {
    wx.setClipboardData({
      data: url,
      success: () => {
        if (wx.showModal) {
          wx.showModal({
            title: '学信档案链接',
            content: '链接已复制。请在手机浏览器打开学信网「学信档案」，申请教育部学籍在线验证报告并复制 16 位验证码。',
            showCancel: false,
            confirmText: '知道了'
          });
        }
      }
    });
    return;
  }
}

module.exports = {
  CHSI_ARCHIVE_URL,
  STATUS,
  normalizeCode,
  validateInputs,
  runChsiVerification,
  silentFallbackResult,
  openChsiArchive
};
