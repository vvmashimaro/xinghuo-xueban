/**
 * 星火学伴 · 微信手机号授权
 * 调用微信 phonenumber.getPhoneNumber 接口解密用户手机号
 */
'use strict';

const https = require('https');

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;
const WX_PHONE_MODE = process.env.WX_PHONE_MODE || 'mock';

// Access Token 缓存
let accessTokenCache = null;
let accessTokenExpiry = 0;

/**
 * 获取微信 Access Token
 */
async function getAccessToken() {
  const now = Date.now();
  
  // 使用缓存的 token（提前5分钟刷新）
  if (accessTokenCache && now < accessTokenExpiry - 300000) {
    return accessTokenCache;
  }
  
  if (!WECHAT_APP_ID || !WECHAT_APP_SECRET) {
    throw new Error('微信小程序配置不完整：缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET');
  }
  
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            accessTokenCache = json.access_token;
            accessTokenExpiry = now + (json.expires_in || 7200) * 1000;
            resolve(accessTokenCache);
          } else {
            reject(new Error(json.errmsg || '获取 access_token 失败'));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * 调用微信 phonenumber.getPhoneNumber 接口
 * @param {string} code - 微信返回的 code
 * @returns {Promise<{phoneNumber: string, purePhoneNumber: string, countryCode: string}>}
 */
async function getPhoneNumber(code) {
  const accessToken = await getAccessToken();
  
  const postData = JSON.stringify({ code });
  const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errcode === 0 && json.phone_info) {
            resolve({
              phoneNumber: json.phone_info.phoneNumber,
              purePhoneNumber: json.phone_info.purePhoneNumber,
              countryCode: json.phone_info.countryCode
            });
          } else {
            reject(new Error(json.errmsg || '获取手机号失败'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Mock 模式：用于开发测试
 */
function mockGetPhoneNumber(code) {
  console.log(`[WeChat Phone Mock] Code: ${code}`);
  
  // Mock 映射表
  const mockMap = {
    'MOCK_OK': '13980889211',
    'MOCK_PARENT_1': '13880123456',
    'MOCK_PARENT_2': '15928114422',
    'MOCK_MENTOR_1': '18628009821',
    'MOCK_DENY': null // 用户拒绝授权
  };
  
  if (code === 'MOCK_DENY') {
    return Promise.reject(new Error('用户拒绝授权'));
  }
  
  const phone = mockMap[code] || '13900000000';
  
  return Promise.resolve({
    phoneNumber: phone,
    purePhoneNumber: phone,
    countryCode: '86'
  });
}

/**
 * 统一入口：获取用户手机号
 */
async function getUserPhone(code) {
  if (!code) {
    throw new Error('缺少 code 参数');
  }
  
  // Mock 模式
  if (WX_PHONE_MODE === 'mock' || (!WECHAT_APP_ID && !WECHAT_APP_SECRET)) {
    console.log('[WeChat Phone] 使用 Mock 模式');
    return mockGetPhoneNumber(code);
  }
  
  // 生产模式
  return getPhoneNumber(code);
}

module.exports = {
  getUserPhone,
  getAccessToken,
  mockGetPhoneNumber
};
