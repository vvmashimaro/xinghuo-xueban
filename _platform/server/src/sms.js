/**
 * 星火学伴 · 短信服务
 * 支持 mock（开发）、tencent（腾讯云 SMS）
 */
'use strict';

const crypto = require('crypto');
const https = require('https');

// 短信验证码存储（生产环境应使用 Redis 等）
const codeStore = new Map(); // { phone: { codeHash, scene, expiry, attempts } }
const sendCooldown = new Map(); // { phone: lastSendTime }
const dailyCount = new Map(); // { phone: { count, date } }

const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟
const SEND_COOLDOWN_MS = parseInt(process.env.SMS_COOLDOWN_MS || '60000', 10); // 60秒发送间隔（测试可设为 0）
const MAX_VERIFY_ATTEMPTS = 3; // 最多验证3次
const MAX_DAILY_SENDS = 10; // 每天最多发送10次

function getProvider() {
  return process.env.SMS_PROVIDER || 'mock';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isTencentCredentialsReady() {
  return Boolean(
    process.env.TENCENT_SMS_SECRET_ID &&
      process.env.TENCENT_SMS_SECRET_KEY &&
      process.env.TENCENT_SMS_SDK_APP_ID
  );
}

/**
 * 按场景解析腾讯云模板 ID（未配置则返回空）
 */
function resolveTencentTemplateId(scene) {
  switch (scene) {
    case 'login':
      return process.env.TENCENT_SMS_TEMPLATE_LOGIN || '';
    case 'booking':
      return process.env.TENCENT_SMS_TEMPLATE_BOOKING || '';
    case 'accept':
    case 'accept_parent':
      return (
        process.env.TENCENT_SMS_TEMPLATE_ACCEPT ||
        process.env.TENCENT_SMS_TEMPLATE_BOOKING ||
        ''
      );
    case 'accept_mentor':
      return process.env.TENCENT_SMS_TEMPLATE_ACCEPT_MENTOR || '';
    case 'cancel':
      return process.env.TENCENT_SMS_TEMPLATE_CANCEL || '';
    default:
      return '';
  }
}

/**
 * 检查发送冷却时间
 */
function checkSendCooldown(phone) {
  const now = Date.now();
  const lastSend = sendCooldown.get(phone);

  if (lastSend && now - lastSend < SEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((SEND_COOLDOWN_MS - (now - lastSend)) / 1000);
    return { ok: false, error: `发送过于频繁，请 ${waitSeconds} 秒后再试`, retryAfter: waitSeconds };
  }

  return { ok: true };
}

/**
 * 获取当前日期（Asia/Shanghai 时区）
 */
function getCurrentDate() {
  const now = new Date();
  // 转换为 Asia/Shanghai 时区（UTC+8）
  const shanghaiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shanghaiTime.toISOString().split('T')[0];
}

/**
 * 检查每日发送次数限制
 */
function checkDailyLimit(phone) {
  const today = getCurrentDate();
  const record = dailyCount.get(phone);

  if (!record || record.date !== today) {
    // 新的一天，不增加计数，只检查
    return { ok: true };
  }

  if (record.count >= MAX_DAILY_SENDS) {
    return { ok: false, error: '今日发送次数已达上限，请明天再试' };
  }

  return { ok: true };
}

/**
 * 记录成功的发送（只有发送成功后才调用）
 */
function recordSuccessfulSend(phone) {
  const today = getCurrentDate();
  const record = dailyCount.get(phone);

  if (!record || record.date !== today) {
    dailyCount.set(phone, { count: 1, date: today });
  } else {
    record.count += 1;
  }
}

/**
 * 生成6位数字验证码
 */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 计算验证码哈希（存储用）
 */
function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Mock 短信发送（开发/演示模式）
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @param {string} scene - 场景
 * @param {object} auth - auth 模块（用于检查管理员手机）
 */
function maskPhoneForLog(phone) {
  if (!phone || typeof phone !== 'string') return '***';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

async function sendMockSMS(phone, code, scene, auth = null) {
  const maskedPhone = maskPhoneForLog(phone);

  // 检查是否为管理员手机号
  const isAdmin = auth && typeof auth.isAdminPhone === 'function' && auth.isAdminPhone(phone);

  if (isAdmin) {
    // 对于管理员手机号，记录真实验证码到日志（用于 pm2 logs 查看）
    console.log(`[mock-sms] ${maskedPhone} code=${code}`);
    // 管理员不能使用 888888
    return { success: true, provider: 'mock', message: '验证码已发送（管理员需使用真实验证码）' };
  }

  return { success: true, provider: 'mock', message: '演示模式：请使用 888888' };
}

function logMockTransactional(phone, scene, templateParamSet) {
  console.log(
    `[SMS Mock] scene=${scene} to=${maskPhoneForLog(phone)} params=${JSON.stringify(templateParamSet)}`
  );
  return { success: true, provider: 'mock', message: 'Mock 通知已记录' };
}

/**
 * 腾讯云 TC3-HMAC-SHA256 签名
 */
function tencentCloudSign(secretKey, date, service, stringToSign) {
  const kDate = crypto.createHmac('sha256', 'TC3' + secretKey).update(date).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
}

function buildTemplateParamSet(scene, payload) {
  if (scene === 'login') {
    return [String(payload), '5'];
  }
  const info = payload || {};
  const tutorName = info.tutorName || '导师';
  const studentName = info.studentName || '学员';
  const subject = info.subject || '课程';
  const schedule = info.schedule || '';
  const space = info.space || '';
  const reason = info.reason || '已取消';

  switch (scene) {
    case 'accept_mentor':
      return [studentName, subject, schedule, space];
    case 'cancel': {
      const cancelledBy = info.cancelledBy || 'system';
      const displayName = cancelledBy === 'parent' ? studentName : tutorName;
      return [displayName, subject, schedule, reason];
    }
    case 'booking':
    case 'accept':
    case 'accept_parent':
    default:
      return [tutorName, subject, schedule, space];
  }
}

/**
 * 腾讯云短信发送（真实实现）
 * API: SendSms, version 2021-01-11, TC3-HMAC-SHA256 signing
 */
async function sendTencentTemplateSMS(phone, scene, payload) {
  const secretId = process.env.TENCENT_SMS_SECRET_ID;
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY;
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID;
  const signName = process.env.TENCENT_SMS_SIGN_NAME || '星火学伴';
  const region = process.env.TENCENT_SMS_REGION || 'ap-guangzhou';
  const templateId = resolveTencentTemplateId(scene);

  if (!isTencentCredentialsReady() || !templateId) {
    console.log(`[SMS Tencent] 配置不完整（scene=${scene}），降级到 mock`);
    if (scene === 'login') {
      return sendMockSMS(phone, payload, scene);
    }
    return logMockTransactional(phone, scene, buildTemplateParamSet(scene, payload));
  }

  const templateParamSet = buildTemplateParamSet(scene, payload);

  const host = 'sms.tencentcloudapi.com';
  const service = 'sms';
  const version = '2021-01-11';
  const action = 'SendSms';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().split('T')[0];

  const params = {
    PhoneNumberSet: [`+86${phone}`],
    SmsSdkAppId: sdkAppId,
    SignName: signName,
    TemplateId: templateId,
    TemplateParamSet: templateParamSet
  };

  const payloadBody = JSON.stringify(params);

  const hashedRequestPayload = crypto.createHash('sha256').update(payloadBody).digest('hex');
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;
  const signature = tencentCloudSign(secretKey, date, service, stringToSign);
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadBody),
        Host: host,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': timestamp,
        'X-TC-Region': region,
        Authorization: authorization
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          if (result.Response && result.Response.Error) {
            console.error('[SMS Tencent] API Error:', result.Response.Error);
            reject(new Error(result.Response.Error.Message || '腾讯云短信发送失败'));
            return;
          }

          if (result.Response && result.Response.SendStatusSet) {
            const status = result.Response.SendStatusSet[0];
            if (status.Code === 'Ok') {
              console.log(`[SMS Tencent] 短信发送成功 scene=${scene} ${maskPhoneForLog(phone)}`);
              resolve({ success: true, provider: 'tencent', message: '短信已发送' });
            } else {
              console.error('[SMS Tencent] 发送失败:', status.Message);
              reject(new Error(status.Message || '短信发送失败'));
            }
          } else {
            reject(new Error('未知的响应格式'));
          }
        } catch (e) {
          console.error('[SMS Tencent] Parse error:', e);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[SMS Tencent] Request error:', e);
      reject(e);
    });

    req.write(payloadBody);
    req.end();
  });
}

/** @deprecated 内部兼容：login 传字符串验证码，业务通知传对象 */
async function sendTencentSMS(phone, codeOrInfo, scene) {
  return sendTencentTemplateSMS(phone, scene, codeOrInfo);
}

/**
 * 发送短信验证码
 * @param {string} phone - 手机号
 * @param {string} scene - 场景
 * @param {object} auth - auth 模块（用于检查管理员手机）
 */
async function sendSMS(phone, scene = 'login', auth = null) {
  // 参数校验
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, error: '手机号格式不正确' };
  }

  // 检查发送冷却时间
  const cooldownCheck = checkSendCooldown(phone);
  if (!cooldownCheck.ok) {
    return { success: false, error: cooldownCheck.error, retryAfter: cooldownCheck.retryAfter };
  }

  // 检查每日限额
  const dailyCheck = checkDailyLimit(phone);
  if (!dailyCheck.ok) {
    return { success: false, error: dailyCheck.error };
  }

  // 生成验证码
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiry = Date.now() + CODE_EXPIRY_MS;

  // 存储验证码哈希
  codeStore.set(phone, { codeHash, scene, expiry, attempts: 0 });

  const provider = getProvider();
  let result;

  try {
    if (provider === 'tencent' && isTencentCredentialsReady() && resolveTencentTemplateId('login')) {
      result = await sendTencentTemplateSMS(phone, 'login', code);
    } else if (provider === 'tencent') {
      console.log('[SMS] 腾讯云登录模板未配置完整，使用 mock 发送验证码');
      result = await sendMockSMS(phone, code, scene, auth);
    } else {
      result = await sendMockSMS(phone, code, scene, auth);
    }

    sendCooldown.set(phone, Date.now());
    recordSuccessfulSend(phone);

    return { success: true, provider: result.provider, message: result.message };
  } catch (error) {
    console.error('[SMS Error]', error);

    codeStore.delete(phone);

    if (isProduction() && provider === 'tencent') {
      return { success: false, error: '短信发送失败，请稍后重试' };
    }

    return { success: true, provider: 'mock-fallback', message: '开发模式：验证码 888888' };
  }
}

/**
 * 验证短信验证码
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @param {string} scene - 场景
 * @param {object} auth - auth 模块（用于生成验证票据）
 * @returns {object} { success, phone, scene, ticket, mock } or { success: false, error }
 */
function verifySMS(phone, code, scene = 'login', auth = null) {
  if (!phone || !code) {
    return { success: false, error: '手机号和验证码不能为空' };
  }

  const isAdmin = auth && typeof auth.isAdminPhone === 'function' && auth.isAdminPhone(phone);
  if (isAdmin && code === '888888') {
    return { success: false, error: '管理员请使用短信验证码登录' };
  }

  if (!isProduction() && code === '888888' && !isAdmin) {
    console.log(`[SMS Verify] Mock 验证通过：${maskPhoneForLog(phone)}`);

    const ticket = auth ? auth.createVerificationTicket(phone, true) : null;

    return { success: true, phone, scene, mock: true, ticket };
  }

  if (isProduction() && code === '888888') {
    return { success: false, error: '验证码错误' };
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

  const codeHash = hashCode(code);
  if (stored.codeHash !== codeHash) {
    return { success: false, error: '验证码错误', attemptsLeft: MAX_VERIFY_ATTEMPTS - stored.attempts };
  }

  codeStore.delete(phone);

  const ticket = auth ? auth.createVerificationTicket(phone) : null;

  return { success: true, phone, scene, ticket };
}

async function sendTransactionalNotification(phone, scene, bookingInfo, options = {}) {
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, error: '手机号格式不正确' };
  }

  const provider = getProvider();
  const templateId = resolveTencentTemplateId(scene);
  const payload = Object.assign({}, bookingInfo, options);

  if (provider === 'mock' || (provider === 'tencent' && !templateId)) {
    return logMockTransactional(phone, scene, buildTemplateParamSet(scene, payload));
  }

  if (provider === 'tencent') {
    try {
      return await sendTencentTemplateSMS(phone, scene, payload);
    } catch (error) {
      console.error(`[SMS ${scene} Error]`, error);
      return { success: false, error: error.message || '短信发送失败' };
    }
  }

  return logMockTransactional(phone, scene, buildTemplateParamSet(scene, payload));
}

/**
 * 发送预约成功通知短信（创建约课）
 */
async function sendBookingNotification(phone, bookingInfo) {
  return sendTransactionalNotification(phone, 'booking', bookingInfo);
}

/**
 * 导师接单：通知家长
 */
async function sendBookingAcceptNotification(phone, bookingInfo) {
  return sendTransactionalNotification(phone, 'accept', bookingInfo);
}

/**
 * 导师接单：可选通知导师本人
 */
async function sendBookingMentorAcceptNotification(phone, bookingInfo) {
  const templateId = resolveTencentTemplateId('accept_mentor');
  if (!templateId) {
    return { success: true, provider: 'skip', message: '未配置导师接单确认模板' };
  }
  return sendTransactionalNotification(phone, 'accept_mentor', bookingInfo);
}

/**
 * 退单/拒单通知
 * @param {{ cancelledBy?: 'parent'|'mentor' }} options
 */
async function sendBookingCancelNotification(phone, bookingInfo, options = {}) {
  const cancelledBy = options.cancelledBy === 'parent' ? 'parent' : 'mentor';
  return sendTransactionalNotification(phone, 'cancel', bookingInfo, { cancelledBy });
}

module.exports = {
  sendSMS,
  verifySMS,
  sendBookingNotification,
  sendBookingAcceptNotification,
  sendBookingMentorAcceptNotification,
  sendBookingCancelNotification,
  getProvider,
  isProduction,
  isTencentCredentialsReady,
  resolveTencentTemplateId,
  buildTemplateParamSet
};
