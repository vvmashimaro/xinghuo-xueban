/**
 * 星火学伴 · 微信小程序 jscode2session（获取 openid）
 */
'use strict';

const https = require('https');

/**
 * WX_SESSION_MODE wins over WX_PHONE_MODE. An explicit `mock` copied from the
 * example env stays mock even when WX_PHONE_MODE=production.
 * Read on each call so tests and process env stay in sync.
 */
function sessionMode() {
  return String(process.env.WX_SESSION_MODE || process.env.WX_PHONE_MODE || 'mock').trim();
}

function appCredentials() {
  return {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || ''
  };
}

function isConfigReady() {
  const { appId, appSecret } = appCredentials();
  return !!(appId && appSecret);
}

function realJsapiPrepayEnabled() {
  const wechatPay = require('./wechat-pay');
  return typeof wechatPay.isConfigComplete === 'function' && wechatPay.isConfigComplete();
}

function missingCredentialError(realPay) {
  const { appId, appSecret } = appCredentials();
  if (!appSecret) {
    return new Error(
      realPay
        ? '缺少 WECHAT_APP_SECRET，无法换取 openid。真实支付已启用，不能回退到模拟 openid'
        : '缺少 WECHAT_APP_SECRET，无法换取 openid'
    );
  }
  if (!appId) {
    return new Error('缺少 WECHAT_APP_ID，无法换取 openid');
  }
  return new Error('缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET，无法换取 openid');
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Mock：开发联调，code 与 openid 映射
 */
function mockCode2Session(code) {
  const mockMap = {
    MOCK_WX_LOGIN: 'oMOCK-openid-parent-001',
    MOCK_WX_LOGIN_2: 'oMOCK-openid-parent-002'
  };
  const openid = mockMap[code] || `oMOCK-${String(code || 'default').slice(0, 16)}`;
  return {
    openid,
    session_key: `mock-session-${openid}`,
    unionid: null,
    mock: true
  };
}

/**
 * 调用微信 jscode2session
 * @param {string} jsCode wx.login 返回的 code（一次性）
 */
async function code2Session(jsCode) {
  if (!jsCode) {
    throw new Error('缺少微信登录 code');
  }

  const mode = sessionMode();
  const ready = isConfigReady();
  const realPay = realJsapiPrepayEnabled();

  if (mode === 'mock') {
    if (realPay) {
      if (!ready) throw missingCredentialError(true);
      throw new Error(
        '真实微信支付已启用，不能使用模拟 openid。WX_SESSION_MODE 优先于 WX_PHONE_MODE，请设置为 production'
      );
    }
    console.log('[WeChat Session] 使用 Mock 模式');
    return mockCode2Session(jsCode);
  }

  if (!ready) {
    throw missingCredentialError(false);
  }

  const { appId, appSecret } = appCredentials();
  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${encodeURIComponent(appId)}` +
    `&secret=${encodeURIComponent(appSecret)}` +
    `&js_code=${encodeURIComponent(jsCode)}` +
    '&grant_type=authorization_code';

  const json = await httpsGetJson(url);
  if (json.errcode) {
    throw new Error(json.errmsg || `jscode2session 失败 (${json.errcode})`);
  }
  if (!json.openid) {
    throw new Error('jscode2session 未返回 openid');
  }

  return {
    openid: json.openid,
    session_key: json.session_key,
    unionid: json.unionid || null,
    mock: false
  };
}

module.exports = {
  code2Session,
  mockCode2Session,
  isConfigReady,
  sessionMode
};
