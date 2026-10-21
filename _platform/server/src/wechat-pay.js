/**
 * 星火学伴 · 微信支付服务
 * 支持 JSAPI（小程序）、Native（扫码）支付
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

const WECHAT_API_HOST = 'api.mch.weixin.qq.com';

// 模拟支付订单存储（生产环境应使用数据库）
const mockOrders = new Map();

// 微信平台证书缓存 serial -> PEM public key
const platformPublicKeys = new Map();
let platformCertsFetchedAt = 0;
const PLATFORM_CERT_TTL_MS = 12 * 60 * 60 * 1000;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isMockPayAllowed() {
  if (isProduction()) {
    return process.env.ALLOW_MOCK_PAY === 'true';
  }
  return true;
}

function getWeChatPayConfig() {
  return {
    mchId: process.env.WECHAT_MCH_ID,
    appId: process.env.WECHAT_APP_ID,
    apiV3Key: process.env.WECHAT_API_V3_KEY,
    mchSerialNo: process.env.WECHAT_MCH_SERIAL_NO,
    privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH,
    privateKeyPem: process.env.WECHAT_PRIVATE_KEY_PEM,
    notifyUrl: process.env.WECHAT_NOTIFY_URL
  };
}

function isConfigComplete() {
  const config = getWeChatPayConfig();
  return !!(
    config.mchId &&
    config.appId &&
    config.apiV3Key &&
    config.mchSerialNo &&
    (config.privateKeyPath || config.privateKeyPem) &&
    config.notifyUrl
  );
}

function loadPrivateKey() {
  const config = getWeChatPayConfig();

  if (config.privateKeyPem) {
    return config.privateKeyPem.replace(/\\n/g, '\n');
  }

  if (config.privateKeyPath) {
    const keyPath = path.resolve(__dirname, '..', config.privateKeyPath);
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    }
  }

  return null;
}

function signMessage(message) {
  const privateKey = loadPrivateKey();
  if (!privateKey) {
    throw new Error('商户私钥未配置');
  }
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  return sign.sign(privateKey, 'base64');
}

/**
 * 生成签名（微信支付 V3 API 商户请求）
 */
function generateSignature(method, url, timestamp, nonce, body) {
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
  return signMessage(message);
}

function generateNonceStr() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

function buildAuthorization(method, urlPath, body) {
  const config = getWeChatPayConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = generateNonceStr();
  const bodyStr = body === undefined || body === null ? '' : body;
  const signature = generateSignature(method, urlPath, timestamp, nonceStr, bodyStr);
  return {
    timestamp,
    nonceStr,
    authorization:
      `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",` +
      `signature="${signature}",timestamp="${timestamp}",serial_no="${config.mchSerialNo}"`
  };
}

function wechatPayRequest(method, urlPath, bodyObj) {
  const body = bodyObj ? JSON.stringify(bodyObj) : '';
  const { authorization } = buildAuthorization(method, urlPath, body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: WECHAT_API_HOST,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authorization,
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const json = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
              return;
            }
            const msg = json.message || json.detail || raw || `HTTP ${res.statusCode}`;
            reject(new Error(msg));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * AES-256-GCM 解密为原始字符串（平台证书为 PEM 明文，回调 resource 为 JSON）
 */
function decryptAes256GcmRaw({ ciphertext, associated_data, nonce }, apiV3Key) {
  const key = Buffer.from(apiV3Key, 'utf8');
  const buf = Buffer.from(ciphertext, 'base64');
  const authTag = buf.slice(buf.length - 16);
  const data = buf.slice(0, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
  if (associated_data) {
    decipher.setAAD(Buffer.from(associated_data, 'utf8'));
  }
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function decryptAes256Gcm({ ciphertext, associated_data, nonce }, apiV3Key) {
  const decoded = decryptAes256GcmRaw({ ciphertext, associated_data, nonce }, apiV3Key);
  return JSON.parse(decoded);
}

function decryptNotifyResource(resource) {
  const config = getWeChatPayConfig();
  if (!config.apiV3Key) {
    throw new Error('未配置 WECHAT_API_V3_KEY');
  }
  return decryptAes256Gcm(resource, config.apiV3Key);
}

function parsePlatformCertPem(decoded) {
  if (decoded == null) return '';
  if (typeof decoded === 'string') return decoded;
  if (typeof decoded === 'object' && decoded.certificate) return String(decoded.certificate);
  return String(decoded);
}

async function ensurePlatformCertificates() {
  const now = Date.now();
  if (platformPublicKeys.size && now - platformCertsFetchedAt < PLATFORM_CERT_TTL_MS) {
    return;
  }

  const config = getWeChatPayConfig();
  const json = await wechatPayRequest('GET', '/v3/certificates');
  const list = json.data || [];
  list.forEach((item) => {
    if (!item || !item.serial_no || !item.encrypt_certificate) return;
    // 平台证书解密后是 PEM 纯文本，不能 JSON.parse
    const certPem = parsePlatformCertPem(
      decryptAes256GcmRaw(item.encrypt_certificate, config.apiV3Key)
    );
    if (certPem && certPem.indexOf('BEGIN CERTIFICATE') >= 0) {
      platformPublicKeys.set(item.serial_no, certPem);
    } else {
      console.warn('[WeChat Pay] 平台证书解密结果不是 PEM serial:', item.serial_no);
    }
  });
  platformCertsFetchedAt = now;
}

async function verifyNotifySignature(signature, timestamp, nonce, rawBody, serial) {
  if (!signature || !timestamp || !nonce || rawBody == null || !serial) {
    return false;
  }
  const ts = Number(timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) {
    console.warn('[WeChat Pay] 回调时间戳超出5分钟有效窗口:', timestamp);
    return false;
  }
  try {
    await ensurePlatformCertificates();
    let certPem = platformPublicKeys.get(serial);
    if (!certPem) {
      platformCertsFetchedAt = 0;
      await ensurePlatformCertificates();
      certPem = platformPublicKeys.get(serial);
    }
    if (!certPem) {
      console.warn('[WeChat Pay] 未找到平台证书 serial:', serial);
      return false;
    }
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    return crypto.createVerify('RSA-SHA256').update(message).verify(certPem, signature, 'base64');
  } catch (err) {
    console.error('[WeChat Pay] 回调验签失败', err.message);
    return false;
  }
}

/**
 * 小程序 / JSAPI 调起支付参数
 */
function buildJsapiPayParams(prepayId) {
  const config = getWeChatPayConfig();
  const appId = config.appId;
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = generateNonceStr();
  const packageStr = `prepay_id=${prepayId}`;
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  const paySign = signMessage(message);

  return {
    appId,
    timeStamp,
    nonceStr,
    package: packageStr,
    signType: 'RSA',
    paySign
  };
}

function registerMockOrder(order) {
  if (order && order.outTradeNo) {
    mockOrders.set(order.outTradeNo, order);
  }
}

/**
 * outTradeNo 格式: BK-{bookingId}-{timestampMs}，bookingId 本身可含连字符。
 */
function parseBookingIdFromOutTradeNo(outTradeNo) {
  if (!outTradeNo || typeof outTradeNo !== 'string') return null;
  if (!outTradeNo.startsWith('BK-')) return null;
  const rest = outTradeNo.slice(3);
  const lastDash = rest.lastIndexOf('-');
  if (lastDash <= 0) return null;
  const tail = rest.slice(lastDash + 1);
  if (/^\d{10,}$/.test(tail)) {
    return rest.slice(0, lastDash);
  }
  return rest.split('-')[0] || null;
}

function hydrateMockOrders(orders) {
  if (!Array.isArray(orders)) return;
  orders.forEach((o) => registerMockOrder(o));
}

function createMockPrepay(bookingId, amount, description) {
  const prepayId = `MOCK-PREPAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const outTradeNo = `BK-${bookingId}-${Date.now()}`;

  mockOrders.set(outTradeNo, {
    prepayId,
    outTradeNo,
    bookingId,
    amount,
    description,
    status: 'NOTPAY',
    createTime: new Date().toISOString(),
    mock: true
  });

  console.log(`[WeChat Pay Mock] 创建预支付订单`);
  console.log(`[WeChat Pay Mock] 商户订单号: ${outTradeNo}`);
  console.log(`[WeChat Pay Mock] 预支付ID: ${prepayId}`);
  console.log(`[WeChat Pay Mock] 金额: ¥${(amount / 100).toFixed(2)}`);
  console.log(`[WeChat Pay Mock] 开发提示：调用 POST /api/pay/wechat/mock-confirm 模拟支付成功`);

  return {
    prepayId,
    outTradeNo,
    codeUrl: null,
    mock: true,
    payType: 'MOCK',
    message: 'Mock 预支付已创建，使用 /api/pay/wechat/mock-confirm 模拟完成'
  };
}

async function createRealPrepay(bookingId, amount, description, openid, payType = 'JSAPI') {
  const config = getWeChatPayConfig();
  const normalizedType = String(payType || 'JSAPI').toUpperCase();
  const isNative = normalizedType === 'NATIVE';
  const outTradeNo = `BK-${bookingId}-${Date.now()}`;

  const requestBody = {
    appid: config.appId,
    mchid: config.mchId,
    description: description || '星火学伴 · 课程预约',
    out_trade_no: outTradeNo,
    notify_url: config.notifyUrl,
    amount: {
      total: amount,
      currency: 'CNY'
    }
  };

  if (!isNative) {
    if (!openid) {
      throw new Error('JSAPI 支付需要 openid，请先调用 wx.login 并绑定微信会话');
    }
    requestBody.payer = { openid };
  }

  const url = isNative ? '/v3/pay/transactions/native' : '/v3/pay/transactions/jsapi';
  const json = await wechatPayRequest('POST', url, requestBody);

  if (isNative) {
    return {
      outTradeNo,
      codeUrl: json.code_url,
      prepayId: null,
      mock: false,
      payType: 'NATIVE'
    };
  }

  const jsapi = buildJsapiPayParams(json.prepay_id);
  return {
    prepayId: json.prepay_id,
    outTradeNo,
    mock: false,
    payType: 'JSAPI',
    ...jsapi
  };
}

async function createPrepay(params) {
  const { bookingId, amount, description, openid, payType } = params;

  if (!bookingId || !amount) {
    throw new Error('缺少必要参数：bookingId 或 amount');
  }

  if (!isConfigComplete()) {
    if (isMockPayAllowed()) {
      return createMockPrepay(bookingId, amount, description);
    }
    throw new Error('微信支付配置不完整，无法创建预支付订单');
  }

  return await createRealPrepay(bookingId, amount, description, openid, payType);
}

function mockConfirmPayment(outTradeNo) {
  if (!isMockPayAllowed()) {
    throw new Error('当前环境不允许模拟支付');
  }

  const order = mockOrders.get(outTradeNo);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  if (order.status === 'SUCCESS') {
    return { success: false, error: '订单已支付' };
  }

  order.status = 'SUCCESS';
  order.successTime = new Date().toISOString();
  order.transactionId = `MOCK-WX-${Date.now()}`;

  console.log(`[WeChat Pay Mock] 支付成功`);
  console.log(`[WeChat Pay Mock] 商户订单号: ${outTradeNo}`);
  console.log(`[WeChat Pay Mock] 微信订单号: ${order.transactionId}`);

  return {
    success: true,
    outTradeNo,
    transactionId: order.transactionId,
    bookingId: order.bookingId,
    amount: order.amount,
    mock: true
  };
}

/**
 * 处理支付回调通知（需传入原始 body 字符串用于验签）
 * 生产环境配置缺失时绝不跳过验签；配置完整时始终验签并要求加密 resource。
 */
async function handlePaymentNotify(body, headers, rawBody) {
  const hdrs = headers || {};
  const signature = hdrs['wechatpay-signature'] || hdrs['Wechatpay-Signature'];
  const timestamp = hdrs['wechatpay-timestamp'] || hdrs['Wechatpay-Timestamp'];
  const nonce = hdrs['wechatpay-nonce'] || hdrs['Wechatpay-Nonce'];
  const serial = hdrs['wechatpay-serial'] || hdrs['Wechatpay-Serial'];

  const configReady = isConfigComplete();
  if (isProduction() && !configReady) {
    throw new Error('微信支付配置不完整，拒绝处理回调通知');
  }

  let raw;
  if (rawBody != null) {
    if (typeof rawBody === 'string') raw = rawBody;
    else if (Buffer.isBuffer(rawBody)) raw = rawBody.toString('utf8');
    else raw = JSON.stringify(body);
  } else if (typeof body === 'string') {
    raw = body;
  } else {
    raw = JSON.stringify(body);
  }

  let payload = body;
  if (typeof body === 'string') {
    payload = JSON.parse(body);
  }

  const mustVerify = configReady || isProduction();
  if (mustVerify) {
    if (typeof raw !== 'string' || !raw.length) {
      throw new Error('缺少原始请求体 rawBody，无法验签');
    }
    const valid = await verifyNotifySignature(signature, timestamp, nonce, raw, serial);
    if (!valid) {
      throw new Error('签名验证失败');
    }
    if (!payload || !payload.resource || !payload.resource.ciphertext) {
      throw new Error('回调缺少加密 resource 报文');
    }
  }

  let decryptedData = payload;
  if (payload && payload.resource && payload.resource.ciphertext) {
    decryptedData = decryptNotifyResource(payload.resource);
  } else if (mustVerify) {
    throw new Error('回调缺少加密 resource 报文');
  } else if (payload && payload.event_type && !payload.out_trade_no) {
    throw new Error('回调缺少可解密 resource');
  }

  console.log('[WeChat Pay] 收到支付回调', decryptedData.out_trade_no, decryptedData.trade_state);

  return {
    outTradeNo: decryptedData.out_trade_no,
    transactionId: decryptedData.transaction_id,
    tradeState: decryptedData.trade_state,
    amount: decryptedData.amount?.total,
    payerTotal: decryptedData.amount?.payer_total,
    successTime: decryptedData.success_time
  };
}

function normalizeRefundParams(outTradeNoOrParams, reason) {
  if (outTradeNoOrParams && typeof outTradeNoOrParams === 'object') {
    return Object.assign({}, outTradeNoOrParams);
  }
  return {
    outTradeNo: outTradeNoOrParams,
    reason: reason || ''
  };
}

/**
 * 微信支付 V3 退款（原路退回至用户支付账户）
 * @param {string|object} outTradeNoOrParams - 商户订单号或 { outTradeNo, reason, amountFen, transactionId }
 */
async function refundOrder(outTradeNoOrParams, reason) {
  const params = normalizeRefundParams(outTradeNoOrParams, reason);
  const outTradeNo = params.outTradeNo;
  const refundReason = params.reason || '用户撤销约课';
  const amountFen = Number(params.amountFen);
  const transactionId = params.transactionId;

  if (!outTradeNo) {
    return { success: false, error: '缺少商户订单号' };
  }

  if (mockOrders.has(outTradeNo)) {
    const order = mockOrders.get(outTradeNo);
    if (order.status !== 'SUCCESS') {
      return { success: false, error: '订单未支付，无法退款' };
    }
    order.status = 'REFUND';
    order.refundTime = new Date().toISOString();
    order.refundReason = refundReason;
    console.log(`[WeChat Pay Mock] 退款成功: ${outTradeNo}`);
    return { success: true, outTradeNo, mock: true };
  }

  if (!isConfigComplete()) {
    if (isMockPayAllowed()) {
      return { success: true, outTradeNo, mock: true, message: 'Mock 退款（未配置微信支付）' };
    }
    return { success: false, error: '微信支付配置不完整，无法退款' };
  }

  if (!amountFen || amountFen <= 0) {
    return { success: false, error: '缺少有效退款金额（分）' };
  }

  const outRefundNo = `RF-${String(outTradeNo).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48)}-${Date.now()}`;
  const requestBody = {
    out_trade_no: outTradeNo,
    out_refund_no: outRefundNo.slice(0, 64),
    reason: String(refundReason).slice(0, 80),
    amount: {
      refund: Math.round(amountFen),
      total: Math.round(amountFen),
      currency: 'CNY'
    }
  };
  if (transactionId) {
    requestBody.transaction_id = transactionId;
  }

  let json;
  try {
    json = await wechatPayRequest('POST', '/v3/refund/domestic/refunds', requestBody);
  } catch (err) {
    console.error('[WeChat Pay] 退款请求失败', outTradeNo, err && err.message);
    return {
      success: false,
      error: (err && err.message) || '微信退款请求失败',
      status: 'refund_failed',
      outTradeNo,
      mock: false
    };
  }
  console.log('[WeChat Pay] 退款响应', outTradeNo, json.status, json.refund_id);

  const interpreted = interpretRefundStatus(json);
  if (!interpreted.success) {
    return {
      success: false,
      error: interpreted.error,
      status: interpreted.status,
      outTradeNo,
      outRefundNo: json.out_refund_no || requestBody.out_refund_no,
      refundId: json.refund_id,
      mock: false
    };
  }

  return {
    success: true,
    outTradeNo,
    outRefundNo: json.out_refund_no || requestBody.out_refund_no,
    refundId: json.refund_id,
    status: interpreted.status,
    mock: false
  };
}

function interpretRefundStatus(json) {
  const status = String((json && json.status) || '').toUpperCase();
  if (status === 'ABNORMAL' || status === 'CLOSED') {
    return {
      success: false,
      status,
      error: `微信退款状态异常(${status})，请联系客服处理`
    };
  }
  if (status === 'SUCCESS') {
    return { success: true, status: 'SUCCESS' };
  }
  if (status === 'PROCESSING' || !status) {
    return { success: true, status: status || 'PROCESSING' };
  }
  return {
    success: false,
    status: status || 'refund_failed',
    error: `微信退款状态未知(${status || 'empty'})`
  };
}

function getLocalOrderStatus(outTradeNo) {
  if (mockOrders.has(outTradeNo)) {
    const order = mockOrders.get(outTradeNo);
    return {
      outTradeNo,
      bookingId: order.bookingId,
      amount: order.amount,
      status: order.status,
      transactionId: order.transactionId,
      createTime: order.createTime,
      successTime: order.successTime,
      mock: true
    };
  }
  return null;
}

async function queryTransactionByOutTradeNo(outTradeNo) {
  const local = getLocalOrderStatus(outTradeNo);
  if (local) {
    return {
      outTradeNo,
      bookingId: local.bookingId,
      tradeState: local.status === 'SUCCESS' ? 'SUCCESS' : 'NOTPAY',
      transactionId: local.transactionId,
      successTime: local.successTime,
      amount: local.amount,
      mock: true
    };
  }

  if (!isConfigComplete()) {
    return {
      outTradeNo,
      tradeState: 'NOTPAY',
      mock: true,
      message: '微信支付未配置，无法查询真实订单'
    };
  }

  const config = getWeChatPayConfig();
  const urlPath =
    `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.mchId)}`;
  const json = await wechatPayRequest('GET', urlPath, null);
  return {
    outTradeNo: json.out_trade_no || outTradeNo,
    tradeState: json.trade_state,
    transactionId: json.transaction_id,
    successTime: json.success_time,
    amount: json.amount && json.amount.total,
    mock: false
  };
}

function getOrderStatus(outTradeNo) {
  const local = getLocalOrderStatus(outTradeNo);
  if (local) return local;

  return {
    outTradeNo,
    status: 'NOTPAY',
    message: '请调用同步接口查询微信支付订单状态'
  };
}

module.exports = {
  createPrepay,
  mockConfirmPayment,
  handlePaymentNotify,
  getOrderStatus,
  getLocalOrderStatus,
  queryTransactionByOutTradeNo,
  parseBookingIdFromOutTradeNo,
  isConfigComplete,
  isMockPayAllowed,
  registerMockOrder,
  hydrateMockOrders,
  refundOrder,
  interpretRefundStatus,
  buildJsapiPayParams,
  decryptNotifyResource,
  decryptAes256Gcm,
  decryptAes256GcmRaw,
  parsePlatformCertPem,
  generateSignature,
  signMessage
};
