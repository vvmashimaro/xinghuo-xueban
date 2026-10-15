/**
 * 星火学伴 · 微信小程序 jscode2session（获取 openid）
 */
'use strict';

const https = require('https');

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;
const WX_SESSION_MODE = process.env.WX_SESSION_MODE || process.env.WX_PHONE_MODE || 'mock';

function isConfigReady() {
  return !!(WECHAT_APP_ID && WECHAT_APP_SECRET);
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

  if (WX_SESSION_MODE === 'mock' || !isConfigReady()) {
    console.log('[WeChat Session] 使用 Mock 模式');
    return mockCode2Session(jsCode);
  }

  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${encodeURIComponent(WECHAT_APP_ID)}` +
    `&secret=${encodeURIComponent(WECHAT_APP_SECRET)}` +
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
  isConfigReady
};
