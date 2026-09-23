/**
 * 星火学伴 · 短信服务抽象层
 * 支持 mock（开发）、aliyun（阿里云）、tencent（腾讯云）
 */
'use strict';

const crypto = require('crypto');

// 短信验证码存储（生产环境应使用 Redis 等）
const codeStore = new Map(); // { phone: { code, scene, expiry, attempts } }
const rateLimitStore = new Map(); // { phone: { count, resetTime } }

const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分钟
const MAX_ATTEMPTS_PER_WINDOW = 5;

function getProvider() {
  return process.env.SMS_PROVIDER || 'mock';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * 检查速率限制
 */
function checkRateLimit(phone) {
  const now = Date.now();
  const limit = rateLimitStore.get(phone);
  
  if (!limit) {
    rateLimitStore.set(phone, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  
  if (now > limit.resetTime) {
    rateLimitStore.set(phone, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  
  if (limit.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return { ok: false, error: '发送过于频繁，请稍后再试', retryAfter: Math.ceil((limit.resetTime - now) / 1000) };
  }
  
  limit.count += 1;
  return { ok: true };
}

/**
 * 生成6位数字验证码
 */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Mock 短信发送（开发/演示模式）
 */
async function sendMockSMS(phone, code, scene) {
  console.log(`[SMS Mock] 发送验证码到 ${phone}`);
  console.log(`[SMS Mock] 场景: ${scene}, 验证码: ${code}`);
  console.log(`[SMS Mock] 开发提示：任何手机号都可使用验证码 888888 进行验证`);
  return { success: true, provider: 'mock', message: '演示模式：请使用 888888' };
}

/**
 * 阿里云短信发送（实际调用需要 SDK 或 HTTP API）
 */
async function sendAliyunSMS(phone, code, scene) {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '星火学伴';
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  
  if (!accessKeyId || !accessKeySecret || !templateCode) {
    if (isProduction()) {
      throw new Error('阿里云短信配置不完整：缺少 AccessKey 或模板');
    }
    return sendMockSMS(phone, code, scene);
  }
  
  // TODO: 实际接入阿里云短信 API
  // 这里提供接口占位，客户需要安装 @alicloud/dysmsapi20170525 或使用 HTTP 签名请求
  console.log(`[SMS Aliyun] 准备发送到 ${phone}, 签名: ${signName}, 模板: ${templateCode}`);
  console.log(`[SMS Aliyun] 提示：需要实现阿里云 API 签名与 HTTP 调用`);
  
  // 示例：可使用 @alicloud/dysmsapi20170525
  // const Dysmsapi = require('@alicloud/dysmsapi20170525');
  // const client = new Dysmsapi({ accessKeyId, accessKeySecret, endpoint: 'dysmsapi.aliyuncs.com' });
  // const response = await client.sendSms({
  //   phoneNumbers: phone,
  //   signName: signName,
  //   templateCode: templateCode,
  //   templateParam: JSON.stringify({ code })
  // });
  
  return { success: true, provider: 'aliyun', message: '阿里云短信已发送（占位实现）' };
}

/**
 * 腾讯云短信发送（实际调用需要 SDK 或 HTTP API）
 */
async function sendTencentSMS(phone, code, scene) {
  const appId = process.env.TENCENT_SMS_APP_ID;
  const appKey = process.env.TENCENT_SMS_APP_KEY;
  const signName = process.env.TENCENT_SMS_SIGN_NAME || '星火学伴';
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID;
  
  if (!appId || !appKey || !templateId) {
    if (isProduction()) {
      throw new Error('腾讯云短信配置不完整：缺少 AppId/AppKey 或模板');
    }
    return sendMockSMS(phone, code, scene);
  }
  
  // TODO: 实际接入腾讯云短信 API
  console.log(`[SMS Tencent] 准备发送到 ${phone}, 签名: ${signName}, 模板: ${templateId}`);
  console.log(`[SMS Tencent] 提示：需要实现腾讯云 API 签名与 HTTP 调用`);
  
  // 示例：可使用 tencentcloud-sdk-nodejs-sms
  // const tencentcloud = require('tencentcloud-sdk-nodejs');
  // const SmsClient = tencentcloud.sms.v20210111.Client;
  // const client = new SmsClient({ credential: { secretId: appId, secretKey: appKey }, region: 'ap-guangzhou' });
  // const response = await client.SendSms({
  //   PhoneNumberSet: [`+86${phone}`],
  //   SmsSdkAppId: appId,
  //   SignName: signName,
  //   TemplateId: templateId,
  //   TemplateParamSet: [code]
  // });
  
  return { success: true, provider: 'tencent', message: '腾讯云短信已发送（占位实现）' };
}

/**
 * 发送短信验证码
 */
async function sendSMS(phone, scene = 'login') {
  // 参数校验
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, error: '手机号格式不正确' };
  }
  
  // 速率限制
  const limitCheck = checkRateLimit(phone);
  if (!limitCheck.ok) {
    return { success: false, error: limitCheck.error, retryAfter: limitCheck.retryAfter };
  }
  
  // 生成验证码
  const code = generateCode();
  const expiry = Date.now() + CODE_EXPIRY_MS;
  
  // 存储验证码
  codeStore.set(phone, { code, scene, expiry, attempts: 0 });
  
  // 根据提供商发送
  const provider = getProvider();
  let result;
  
  try {
    switch (provider) {
      case 'aliyun':
        result = await sendAliyunSMS(phone, code, scene);
        break;
      case 'tencent':
        result = await sendTencentSMS(phone, code, scene);
        break;
      case 'mock':
      default:
        result = await sendMockSMS(phone, code, scene);
        break;
    }
    
    return { success: true, provider: result.provider, message: result.message };
  } catch (error) {
    console.error('[SMS Error]', error);
    
    // 生产环境失败不应降级到 mock
    if (isProduction()) {
      return { success: false, error: '短信发送失败，请稍后重试' };
    }
    
    // 开发环境可以继续使用 mock
    return { success: true, provider: 'mock-fallback', message: '开发模式：验证码 888888' };
  }
}

/**
 * 验证短信验证码
 */
function verifySMS(phone, code, scene = 'login') {
  const MAX_VERIFY_ATTEMPTS = 3;
  
  if (!phone || !code) {
    return { success: false, error: '手机号和验证码不能为空' };
  }
  
  // Mock 万能验证码（开发环境）
  if (!isProduction() && code === '888888') {
    console.log(`[SMS Verify] Mock 验证通过：${phone}`);
    return { success: true, phone, scene, mock: true };
  }
  
  const stored = codeStore.get(phone);
  
  if (!stored) {
    return { success: false, error: '验证码不存在或已过期' };
  }
  
  if (Date.now() > stored.expiry) {
    codeStore.delete(phone);
    return { success: false, error: '验证码已过期' };
  }
  
  if (stored.scene !== scene) {
    return { success: false, error: '验证码场景不匹配' };
  }
  
  if (stored.attempts >= MAX_VERIFY_ATTEMPTS) {
    codeStore.delete(phone);
    return { success: false, error: '验证次数过多，请重新获取' };
  }
  
  stored.attempts += 1;
  
  if (stored.code !== code) {
    return { success: false, error: '验证码错误', attemptsLeft: MAX_VERIFY_ATTEMPTS - stored.attempts };
  }
  
  // 验证成功，删除验证码
  codeStore.delete(phone);
  
  return { success: true, phone, scene };
}

module.exports = {
  sendSMS,
  verifySMS,
  getProvider,
  isProduction
};
