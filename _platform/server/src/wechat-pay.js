/**
 * 星火学伴 · 微信支付服务
 * 支持 JSAPI、Native 和小程序支付
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 模拟支付订单存储（生产环境应使用数据库）
const mockOrders = new Map();

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isMockPayAllowed() {
  // 生产环境不允许模拟支付，除非明确设置 ALLOW_MOCK_PAY=true（不推荐）
  if (isProduction()) {
    return process.env.ALLOW_MOCK_PAY === 'true';
  }
  return true;
}

/**
 * 获取微信支付配置
 */
function getWeChatPayConfig() {
  const config = {
    mchId: process.env.WECHAT_MCH_ID,
    appId: process.env.WECHAT_APP_ID,
    apiV3Key: process.env.WECHAT_API_V3_KEY,
    mchSerialNo: process.env.WECHAT_MCH_SERIAL_NO,
    privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH,
    privateKeyPem: process.env.WECHAT_PRIVATE_KEY_PEM,
    notifyUrl: process.env.WECHAT_NOTIFY_URL
  };
  
  return config;
}

/**
 * 检查微信支付配置是否完整
 */
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

/**
 * 加载商户私钥
 */
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

/**
 * 生成签名（微信支付 V3 API）
 */
function generateSignature(method, url, timestamp, nonce, body) {
  const privateKey = loadPrivateKey();
  if (!privateKey) {
    throw new Error('商户私钥未配置');
  }
  
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  return sign.sign(privateKey, 'base64');
}

/**
 * 生成随机字符串
 */
function generateNonceStr() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/**
 * Mock 预支付（开发/演示环境）
 */
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
    codeUrl: null, // Native 支付会返回二维码 URL
    mock: true,
    message: 'Mock 预支付已创建，使用 /api/pay/wechat/mock-confirm 模拟完成'
  };
}

/**
 * 真实微信预支付（JSAPI / 小程序）
 */
async function createRealPrepay(bookingId, amount, description, openid, payType = 'JSAPI') {
  const config = getWeChatPayConfig();
  const outTradeNo = `BK-${bookingId}-${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = generateNonceStr();
  
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
  
  if (payType === 'JSAPI') {
    requestBody.payer = { openid };
  }
  
  const url = '/v3/pay/transactions/jsapi';
  const body = JSON.stringify(requestBody);
  const signature = generateSignature('POST', url, timestamp, nonceStr, body);
  
  // TODO: 实际 HTTP 请求到微信支付 API
  console.log(`[WeChat Pay] 准备调用预支付接口`);
  console.log(`[WeChat Pay] 商户订单号: ${outTradeNo}`);
  console.log(`[WeChat Pay] 提示：需要实现 HTTPS 请求到 https://api.mch.weixin.qq.com${url}`);
  
  // 示例：使用 axios 或 node-fetch
  // const axios = require('axios');
  // const response = await axios.post(`https://api.mch.weixin.qq.com${url}`, requestBody, {
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.mchSerialNo}"`
  //   }
  // });
  // return { prepayId: response.data.prepay_id, outTradeNo };
  
  return {
    prepayId: 'REAL-PREPAY-PLACEHOLDER',
    outTradeNo,
    message: '真实微信支付接口占位，需实现 HTTP 调用'
  };
}

/**
 * 创建预支付订单
 */
async function createPrepay(params) {
  const { bookingId, amount, description, openid, payType } = params;
  
  if (!bookingId || !amount) {
    throw new Error('缺少必要参数：bookingId 或 amount');
  }
  
  // 检查配置
  const configComplete = isConfigComplete();
  
  // 如果配置不完整且允许 mock，则使用 mock
  if (!configComplete) {
    if (isMockPayAllowed()) {
      return createMockPrepay(bookingId, amount, description);
    }
    throw new Error('微信支付配置不完整，无法创建预支付订单');
  }
  
  // 配置完整，调用真实接口
  return await createRealPrepay(bookingId, amount, description, openid, payType);
}

/**
 * Mock 确认支付（仅开发环境）
 */
function mockConfirmPayment(outTradeNo) {
  if (!isMockPayAllowed()) {
    throw new Error('当前环境不允许模拟支付');
  }
  
  const order = mockOrders.get(outTradeNo);
  if (!order) {
    throw new Error('订单不存在');
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
 * 验证微信支付回调签名
 */
function verifyNotifySignature(signature, timestamp, nonce, body) {
  // TODO: 实现微信支付平台证书验证
  // 需要先下载微信支付平台证书，然后验证签名
  console.log('[WeChat Pay] 回调签名验证（占位实现）');
  return true;
}

/**
 * 处理支付回调通知
 */
function handlePaymentNotify(body, headers) {
  const signature = headers['wechatpay-signature'];
  const timestamp = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  
  // 验证签名
  if (isConfigComplete()) {
    const valid = verifyNotifySignature(signature, timestamp, nonce, body);
    if (!valid) {
      throw new Error('签名验证失败');
    }
  }
  
  // TODO: 解密回调内容（微信支付使用 APIv3 密钥加密）
  const decryptedData = body; // 占位
  
  console.log('[WeChat Pay] 收到支付回调通知');
  
  return {
    outTradeNo: decryptedData.out_trade_no,
    transactionId: decryptedData.transaction_id,
    tradeState: decryptedData.trade_state,
    amount: decryptedData.amount?.total,
    successTime: decryptedData.success_time
  };
}

/**
 * 查询订单状态
 */
function getOrderStatus(outTradeNo) {
  // Mock 订单
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
  
  // TODO: 调用微信支付订单查询接口
  console.log(`[WeChat Pay] 查询订单状态: ${outTradeNo} (占位实现)`);
  
  return {
    outTradeNo,
    status: 'NOTPAY',
    message: '真实订单查询接口占位'
  };
}

module.exports = {
  createPrepay,
  mockConfirmPayment,
  handlePaymentNotify,
  getOrderStatus,
  isConfigComplete,
  isMockPayAllowed
};
