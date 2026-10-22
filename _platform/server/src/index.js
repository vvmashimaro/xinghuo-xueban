/**
 * 星火学伴 · 统一库 API
 * 监听 0.0.0.0:8787，供网页与微信小程序共享读写
 */
'use strict';

// 加载环境变量
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const proofUpload = require('./proof-upload');
const db = require('./db');
const sms = require('./sms');
const bookingSmsNotify = require('./booking-sms-notify');
const auth = require('./auth');
const wechatPay = require('./wechat-pay');
const pricing = require('./pricing');
const wechatPhone = require('./wechat-phone');
const wechatSession = require('./wechat-session');
const phoneCrypto = require('./phone-crypto');

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const app = express();

// CORS 配置：生产环境使用白名单
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:8080', 'http://127.0.0.1:8080'];

app.use(cors({
  origin: isProduction ? corsOrigins : '*',
  credentials: true
}));

app.use(
  express.json({
    limit: '8mb',
    verify: (req, _res, buf) => {
      if (buf && buf.length) {
        req.rawBody = buf.toString('utf8');
      }
    }
  })
);

// 工具函数
function ok(res, data) {
  res.json(data);
}

function fail(res, status, message) {
  res.status(status).json({ error: message || 'error' });
}

// 工具函数：返回导师公开资料（白名单；不含手机号、证件、银行卡、学信网码、审核评语、原件 URL）
function publicMentorProfile(mentor) {
  if (!mentor || typeof mentor !== 'object') return mentor;
  const surname = String(mentor.realName || '导').charAt(0) || '导';
  const maskedName = surname + '老师';
  const proofFiles = Array.isArray(mentor.proofFiles)
    ? mentor.proofFiles.map((f) => ({
        name: f && f.name ? String(f.name) : '',
        tag: f && f.tag ? String(f.tag) : '佐证材料',
        verified: !!(f && f.verified)
      }))
    : [];
  return {
    id: mentor.id,
    code: mentor.code || '',
    status: mentor.status || '',
    acceptingOrders: mentor.acceptingOrders !== false,
    realName: maskedName,
    maskedName: maskedName,
    university: mentor.university || '',
    province: mentor.province || '',
    degree: mentor.degree || '',
    chsiStatus: mentor.chsiStatus || '',
    publicTeacherCompliance: !!mentor.publicTeacherCompliance,
    subjects: Array.isArray(mentor.subjects) ? mentor.subjects.slice() : [],
    customSubjects: Array.isArray(mentor.customSubjects) ? mentor.customSubjects.slice() : [],
    hourlyRate: mentor.hourlyRate,
    rateDifficulty: mentor.rateDifficulty || '',
    rateTierNote: mentor.rateTierNote || '',
    scoreHighlight: mentor.scoreHighlight || '',
    styles: Array.isArray(mentor.styles) ? mentor.styles.slice() : [],
    lectureUrl: mentor.lectureUrl || '',
    evalGrade: mentor.evalGrade || '',
    spacePreference: mentor.spacePreference || '',
    preferredSpaces: Array.isArray(mentor.preferredSpaces) ? mentor.preferredSpaces.slice() : [],
    availability: Array.isArray(mentor.availability) ? mentor.availability.slice() : [],
    availableSlots: Array.isArray(mentor.availableSlots) ? mentor.availableSlots.slice() : [],
    proofFiles
  };
}

// 工具函数：脱敏手机号
function maskPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

// 创建认证中间件（注入 db 依赖）
const { requireAuth, requireAdmin, requireAdminToken } = auth.createAuthMiddleware(db);

// 定期清理过期令牌
setInterval(() => {
  auth.cleanupExpiredTokens(db);
}, 60 * 60 * 1000); // 每小时清理一次

// 健康检查（公开）
app.get('/api/health', (req, res) => {
  ok(res, {
    ok: true,
    env: NODE_ENV
  });
});

// 获取数据库快照（需要管理员权限）
app.get('/api/snapshot', requireAdminToken, (req, res) => {
  db.seedIfEmpty();
  ok(res, db.snapshot());
});

function dangerousDbResetAllowed() {
  return !isProduction || process.env.ALLOW_DANGEROUS_DB_RESET === 'true';
}

// 危险操作：替换快照（生产环境默认禁用，需 ALLOW_DANGEROUS_DB_RESET=true）
app.post('/api/snapshot', requireAdminToken, (req, res) => {
  if (!dangerousDbResetAllowed()) {
    return fail(res, 403, '生产环境已禁用全量快照覆盖');
  }
  const body = req.body || {};
  ok(res, db.replaceSnapshot(body));
});

// 危险操作：重置数据库（生产环境默认禁用）
app.post('/api/reset', requireAdminToken, (req, res) => {
  if (!dangerousDbResetAllowed()) {
    return fail(res, 403, '生产环境严禁重置数据库');
  }
  ok(res, db.reset());
});

/* ========== SMS 短信验证码 ========== */
app.post('/api/auth/sms/send', async (req, res) => {
  try {
    const { phone, scene } = req.body || {};
    
    if (!phone) {
      return fail(res, 400, '缺少手机号');
    }
    
    const clientIp = clientIpFromReq(req);
    const result = await sms.sendSMS(phone, scene || 'login', auth, clientIp);
    
    if (!result.success) {
      return res.status(429).json({
        error: result.error,
        retryAfter: result.retryAfter
      });
    }
    
    const requiresRealCode = auth.isAdminPhone(phone) && !sms.isDevOtpEnabled();
    ok(res, {
      success: true,
      message: result.message,
      provider: result.provider,
      requiresRealCode,
      phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') // 脱敏
    });
  } catch (error) {
    console.error('[SMS Send Error]', error);
    fail(res, 500, '短信发送失败');
  }
});

app.post('/api/auth/sms/verify', (req, res) => {
  try {
    const { phone, code, scene } = req.body || {};
    
    if (!phone || !code) {
      return fail(res, 400, '缺少手机号或验证码');
    }
    
    const result = sms.verifySMS(phone, code, scene || 'login', auth);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        attemptsLeft: result.attemptsLeft
      });
    }
    
    ok(res, {
      success: true,
      phone: result.phone,
      scene: result.scene,
      ticket: result.ticket,
      mock: result.mock || false
    });
  } catch (error) {
    console.error('[SMS Verify Error]', error);
    fail(res, 500, '验证失败');
  }
});

/* ========== 登录 / 注册 ========== */
app.post('/api/auth/login', (req, res) => {
  try {
    const { ticket, role } = req.body || {};
    
    if (!ticket) {
      return fail(res, 400, '缺少验证票据，请先完成短信验证');
    }
    
    if (!role || !['parent', 'mentor', 'admin'].includes(role)) {
      return fail(res, 400, '角色参数无效');
    }
    
    // 验证并消费票据（一次性）
    const ticketData = auth.verifyAndConsumeTicket(ticket);
    if (!ticketData) {
      return fail(res, 400, '验证票据无效或已过期');
    }
    
    const { phone, mock } = ticketData;
    
    // 检查是否为管理员手机号
    const isAdmin = auth.isAdminPhone(phone);
    
    // Mock 票据（888888验证码）不能用于管理员登录
    if (isAdmin && mock) {
      return fail(res, 403, '管理员请使用短信验证码登录');
    }
    
    // 如果用户请求 admin 角色但不在管理员白名单中，拒绝登录
    if (role === 'admin' && !isAdmin) {
      return fail(res, 403, '该手机号无管理员权限');
    }
    
    const actualRole = isAdmin ? 'admin' : role;
    
    // 查找用户记录
    let user;
    if (actualRole === 'parent') {
      user = db.getParentByPhone(phone);
      if (!user) {
        return fail(res, 404, '该手机号未注册，请先完成注册');
      }
    } else if (actualRole === 'mentor') {
      user = db.getMentorByPhone(phone);
      if (!user) {
        return fail(res, 404, '该手机号未注册，请先完成注册');
      }
    } else if (actualRole === 'admin') {
      // 管理员直接使用手机号作为标识
      user = { id: 'ADMIN-' + phone, phone };
    }
    
    // 创建会话令牌
    const token = auth.createToken(user.id, actualRole, phone, db);
    
    ok(res, {
      success: true,
      token,
      user: {
        id: user.id,
        role: actualRole,
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      }
    });
  } catch (error) {
    console.error('[Login Error]', error);
    fail(res, 500, '登录失败');
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { ticket, role, profile } = req.body || {};
    
    if (!ticket) {
      return fail(res, 400, '缺少验证票据，请先完成短信验证');
    }
    
    if (!role || !['parent', 'mentor'].includes(role)) {
      return fail(res, 400, '角色参数无效');
    }
    
    // 验证并消费票据（一次性）
    const ticketData = auth.verifyAndConsumeTicket(ticket);
    if (!ticketData) {
      return fail(res, 400, '验证票据无效或已过期');
    }
    
    const { phone } = ticketData;
    
    // 检查手机号是否已注册
    let existing;
    if (role === 'parent') {
      existing = db.getParentByPhone(phone);
      if (existing) {
        return fail(res, 400, '该手机号已注册，请直接登录');
      }
    } else if (role === 'mentor') {
      existing = db.getMentorByPhone(phone);
      if (existing) {
        return fail(res, 400, '该手机号已注册，请直接登录');
      }
    }
    
    // 创建用户记录
    let user;
    const profileData = Object.assign({ phone }, profile || {});
    delete profileData.id;
    profileData.phone = phone;
    if (role === 'mentor') {
      delete profileData.status;
      delete profileData.evalGrade;
      delete profileData.reviewComment;
      delete profileData.code;
      delete profileData.sensitiveChangePending;
    }
    
    if (role === 'parent') {
      user = db.saveParent(profileData);
    } else if (role === 'mentor') {
      user = db.addMentor(profileData);
    }
    
    // 创建会话令牌
    const token = auth.createToken(user.id, role, phone, db);
    
    ok(res, {
      success: true,
      token,
      user: {
        id: user.id,
        role,
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      }
    });
  } catch (error) {
    console.error('[Register Error]', error);
    fail(res, 500, '注册失败');
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  try {
    auth.revokeToken(req.token, db);
    ok(res, { success: true });
  } catch (error) {
    console.error('[Logout Error]', error);
    fail(res, 500, '登出失败');
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  try {
    const { userId, role, phone } = req.user;
    
    let user;
    if (role === 'parent') {
      user = db.getParents().find(p => p.id === userId);
    } else if (role === 'mentor') {
      user = db.getMentorById(userId);
    } else if (role === 'admin') {
      user = { id: userId, phone, role: 'admin' };
    }
    
    if (!user && role !== 'admin') {
      return fail(res, 404, '用户不存在');
    }
    
    ok(res, {
      userId: user.id,
      role,
      phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      profile: user
    });
  } catch (error) {
    console.error('[Get User Error]', error);
    fail(res, 500, '查询失败');
  }
});

/* ========== 微信手机号授权（小程序）========== */
// 无需登录：凭微信 getPhoneNumber 一次性 code 换取验证票据（与短信 verify 相同，供登录/注册/绑定）
app.post('/api/wx/phone', async (req, res) => {
  try {
    const { code } = req.body || {};
    
    if (!code) {
      return fail(res, 400, '缺少 code 参数');
    }
    
    // 调用微信接口获取手机号
    const phoneInfo = await wechatPhone.getUserPhone(code);
    const phone = phoneInfo.purePhoneNumber;
    
    // 生成验证票据（用于后续绑定或登录）
    const ticket = auth.createVerificationTicket(phone);
    
    ok(res, {
      success: true,
      phone,
      countryCode: phoneInfo.countryCode,
      masked: phoneCrypto.maskPhone(phone),
      ticket  // 返回票据用于绑定
    });
  } catch (error) {
    console.error('[WeChat Phone Error]', error);
    fail(res, 400, error.message || '获取手机号失败');
  }
});

/* ========== 手机号绑定管理（小程序合规功能）========== */
app.post('/api/auth/phone/bind', requireAuth, async (req, res) => {
  try {
    const { ticket, source } = req.body || {};
    const userId = req.user.userId;
    
    if (!ticket) {
      return fail(res, 400, '缺少验证票据');
    }
    
    // 验证并消费票据
    const ticketData = auth.verifyAndConsumeTicket(ticket);
    if (!ticketData) {
      return fail(res, 400, '验证票据无效或已过期');
    }
    const phone = ticketData.phone;
    
    if (!phoneCrypto.isValidPhone(phone)) {
      return fail(res, 400, '手机号格式不正确');
    }
    
    const phoneCipher = phoneCrypto.encryptPhone(phone);
    const phoneHash = phoneCrypto.hashPhone(phone);
    
    const result = db.bindPhone(userId, phoneCipher, phoneHash, source || 'wechat_auth', {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
      ua: req.headers['user-agent'] || ''
    });
    
    if (!result.ok) {
      return fail(res, 400, result.error);
    }
    
    ok(res, {
      success: true,
      masked: phoneCrypto.maskPhone(phone)
    });
  } catch (error) {
    console.error('[Phone Bind Error]', error);
    fail(res, 500, '绑定失败');
  }
});

app.post('/api/auth/phone/unbind', requireAuth, (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = db.unbindPhone(userId, {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
      ua: req.headers['user-agent'] || ''
    });
    
    if (!result.ok) {
      return fail(res, 400, result.error);
    }
    
    ok(res, { success: true });
  } catch (error) {
    console.error('[Phone Unbind Error]', error);
    fail(res, 500, '解绑失败');
  }
});

app.post('/api/auth/phone/cancel', requireAuth, (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = db.cancelPhone(userId, {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
      ua: req.headers['user-agent'] || ''
    });
    
    if (!result.ok) {
      return fail(res, 400, result.error);
    }
    
    // 撤销当前会话
    auth.revokeToken(req.token, db);
    
    ok(res, { success: true });
  } catch (error) {
    console.error('[Phone Cancel Error]', error);
    fail(res, 500, '注销失败');
  }
});

const ALLOWED_PHONE_AUDIT_ACTIONS = new Set([
  'view_privacy',
  'click_wechat_phone',
  'consent_agreed',
  'authorize_deny',
  'authorize_allow'
]);
const PHONE_AUDIT_WINDOW_MS = 60 * 1000;
const PHONE_AUDIT_MAX_PER_WINDOW = Math.max(
  1,
  parseInt(process.env.PHONE_AUDIT_MAX_PER_MIN || '20', 10) || 20
);
const phoneAuditRate = new Map();

function checkPhoneAuditRate(userId) {
  const key = String(userId || '');
  const now = Date.now();
  const rec = phoneAuditRate.get(key);
  if (!rec || now - rec.windowStart >= PHONE_AUDIT_WINDOW_MS) {
    phoneAuditRate.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (rec.count >= PHONE_AUDIT_MAX_PER_WINDOW) {
    return { ok: false };
  }
  rec.count += 1;
  return { ok: true };
}

app.post('/api/auth/phone/audit', requireAuth, (req, res) => {
  try {
    const body = req.body || {};
    const action = String(body.action || '')
      .trim()
      .slice(0, 64);
    if (!ALLOWED_PHONE_AUDIT_ACTIONS.has(action)) {
      return fail(res, 400, '不支持的审计动作类型');
    }
    if (!checkPhoneAuditRate(req.user.userId).ok) {
      return fail(res, 429, '操作过于频繁，请稍后再试');
    }
    const sourceRaw = String(body.source || 'client').trim().slice(0, 32);
    const source = /^[a-zA-Z0-9_.-]{1,32}$/.test(sourceRaw) ? sourceRaw : 'client';
    db.logPhoneAudit({
      userId: req.user.userId,
      action,
      source,
      ip: clientIpFromReq(req).slice(0, 64),
      ua: String(req.headers['user-agent'] || '').slice(0, 256),
      success: body.success !== false
    });
    ok(res, { success: true });
  } catch (error) {
    console.error('[Audit Log Error]', error);
    fail(res, 500, '记录失败');
  }
});

/* ========== 微信小程序 openid（jscode2session） ========== */
app.post('/api/wechat/jscode2session', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return fail(res, 400, '缺少 code');
    }
    const session = await wechatSession.code2Session(code);
    if (req.user.role === 'parent') {
      const parents = db.getParents();
      const parent = parents.find((p) => p.id === req.user.userId);
      if (parent) {
        db.saveParent(Object.assign({}, parent, { wechatOpenid: session.openid }));
      }
    }
    ok(res, {
      success: true,
      bound: true,
      mock: !!session.mock
    });
  } catch (error) {
    console.error('[WeChat jscode2session Error]', error);
    fail(res, 500, error.message || '微信登录失败');
  }
});

/* ========== 微信支付 ========== */

function bookingForPayOrderAccess(req, res, payOrder, outTradeNo) {
  const bookingId =
    (payOrder && payOrder.bookingId) || wechatPay.parseBookingIdFromOutTradeNo(outTradeNo);
  const booking = bookingId ? db.getBookings().find((b) => b.id === bookingId) : null;
  if (!booking) return { booking: null, allowed: true };
  if (req.user.role === 'parent') {
    const parent = db.getParents().find((p) => p.id === req.user.userId);
    if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
      fail(res, 403, '只能操作自己的订单');
      return { booking, allowed: false };
    }
  } else if (req.user.role === 'mentor') {
    if (booking.mentorId !== req.user.userId && booking.tutorId !== req.user.userId) {
      fail(res, 403, '无权限');
      return { booking, allowed: false };
    }
  } else if (req.user.role !== 'admin') {
    fail(res, 403, '无权限');
    return { booking, allowed: false };
  }
  return { booking, allowed: true };
}

function clientIpFromReq(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  const ip = (req.ip || (req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, '');
  return ip;
}

function amountsMatchFen(expected, actual) {
  const a = Number(expected);
  const b = Number(actual);
  return Number.isFinite(a) && Number.isFinite(b) && a > 0 && a === b;
}

function applyWeChatPaySuccess(payOrder, result) {
  if (!payOrder) {
    return { ok: false, http: 404, message: '订单不存在' };
  }
  if (payOrder.status === 'SUCCESS') {
    return { ok: true, idempotent: true };
  }
  if (!amountsMatchFen(payOrder.amount, result.amount)) {
    console.error(
      `[WeChat Pay Security] 金额不匹配! outTradeNo=${payOrder.outTradeNo}, 期望=${payOrder.amount}, 实际=${result.amount}`
    );
    return { ok: false, http: 400, message: '订单金额校验失败' };
  }
  db.savePayOrder({
    outTradeNo: payOrder.outTradeNo,
    status: 'SUCCESS',
    transactionId: result.transactionId,
    successTime: result.successTime || new Date().toISOString()
  });
  const booking = payOrder.bookingId
    ? db.getBookings().find((b) => b.id === payOrder.bookingId)
    : null;
  if (booking && booking.paymentStatus !== 'paid') {
    markBookingPaidFromPaySuccess(booking, result);
  }
  return { ok: true, idempotent: false };
}

const notifyLocks = new Set();
const refundLocks = new Set();

const MENTOR_PRIVILEGED_PATCH_KEYS = [
  'status',
  'evalGrade',
  'reviewComment',
  'code',
  'phone',
  'sensitiveChangePending',
  'id'
];
const MENTOR_SENSITIVE_KEYS = [
  'realName',
  'idCard',
  'university',
  'degree',
  'chsiCode',
  'bankName',
  'bankCardNumber',
  'proofFiles'
];

function markBookingPaidFromPaySuccess(booking, payMeta) {
  if (!booking) return null;
  const payable = pricing.isBookingPayable(booking);
  const patch = {
    paymentStatus: 'paid',
    paymentMethod: 'wechat',
    paidAt: payMeta.successTime || new Date().toISOString(),
    transactionId: payMeta.transactionId,
    escrowStatus: 'frozen'
  };
  if (payable.ok && payable.amountYuan != null) {
    patch.amount = payable.amountYuan;
  }
  return db.updateBooking(booking.id, patch, { trust: 'payment' });
}

async function executeWeChatRefundForOrder(payOrder, reason) {
  if (!payOrder) {
    return { ok: false, error: '订单不存在' };
  }
  const outTradeNo = payOrder.outTradeNo;
  if (!outTradeNo) {
    return { ok: false, error: '缺少商户订单号' };
  }
  if (refundLocks.has(outTradeNo)) {
    return { ok: false, error: '退款处理中，请勿重复提交', status: 'refund_pending' };
  }
  if (payOrder.status === 'REFUND' || payOrder.status === 'REFUNDED') {
    return { ok: false, error: '订单已退款' };
  }
  if (payOrder.status === 'refund_pending') {
    return { ok: false, error: '退款处理中，请勿重复提交', status: 'refund_pending' };
  }
  if (payOrder.status !== 'SUCCESS' && payOrder.status !== 'refund_failed') {
    return { ok: false, error: '仅已支付订单可退款' };
  }

  refundLocks.add(outTradeNo);
  try {
    const allowMockRefund =
      wechatPay.isMockPayAllowed() && (!wechatPay.isConfigComplete() || payOrder.mock);

    let wxResult;
    if (allowMockRefund) {
      wxResult = await wechatPay.refundOrder({
        outTradeNo,
        reason,
        amountFen: payOrder.amount,
        transactionId: payOrder.transactionId
      });
      if (!wxResult.success) {
        db.savePayOrder({
          outTradeNo,
          status: 'refund_failed',
          refundWxStatus: wxResult.status || 'refund_failed',
          refundError: wxResult.error || '退款失败'
        });
        return { ok: false, error: wxResult.error || '退款失败', status: 'refund_failed', wx: wxResult };
      }
      return { ok: true, mock: true, wx: wxResult, status: wxResult.status || 'SUCCESS' };
    }

    if (!wechatPay.isConfigComplete()) {
      return { ok: false, error: '当前支付环境不支持退款' };
    }

    wxResult = await wechatPay.refundOrder({
      outTradeNo,
      reason,
      amountFen: payOrder.amount,
      transactionId: payOrder.transactionId
    });
    if (!wxResult.success) {
      db.savePayOrder({
        outTradeNo,
        status: 'refund_failed',
        refundWxStatus: wxResult.status || 'refund_failed',
        refundError: wxResult.error || '微信退款失败'
      });
      return {
        ok: false,
        error: wxResult.error || '微信退款失败',
        status: 'refund_failed',
        wx: wxResult
      };
    }
    const pending = String(wxResult.status || '').toUpperCase() === 'PROCESSING';
    return {
      ok: true,
      mock: false,
      wx: wxResult,
      status: pending ? 'refund_pending' : wxResult.status || 'SUCCESS'
    };
  } finally {
    refundLocks.delete(outTradeNo);
  }
}

async function syncPayOrderWithRemote(outTradeNo) {
  const payOrder = db.getPayOrder(outTradeNo);
  if (!payOrder) {
    return { ok: false, error: '订单不存在', status: 'NOTFOUND' };
  }

  if (payOrder.status === 'SUCCESS') {
    const booking = db.getBookings().find((b) => b.id === payOrder.bookingId);
    return {
      ok: true,
      status: 'SUCCESS',
      paid: true,
      outTradeNo,
      bookingId: payOrder.bookingId,
      paymentStatus: booking && booking.paymentStatus,
      mock: !!payOrder.mock,
      synced: false
    };
  }

  const remote = await wechatPay.queryTransactionByOutTradeNo(outTradeNo);
  const tradeState = remote.tradeState || remote.status;

  if (tradeState !== 'SUCCESS') {
    return {
      ok: true,
      status: tradeState || 'NOTPAY',
      paid: false,
      outTradeNo,
      bookingId: payOrder.bookingId,
      mock: !!remote.mock,
      synced: false
    };
  }

  const applied = applyWeChatPaySuccess(payOrder, remote);
  if (!applied.ok) {
    return { ok: false, error: applied.message || '支付金额校验失败', status: 'AMOUNT_MISMATCH' };
  }

  const refreshed = booking ? db.getBookings().find((b) => b.id === booking.id) : null;
  return {
    ok: true,
    status: 'SUCCESS',
    paid: true,
    outTradeNo,
    bookingId: payOrder.bookingId,
    paymentStatus: refreshed && refreshed.paymentStatus,
    mock: !!remote.mock,
    synced: true
  };
}

app.post('/api/pay/wechat/prepay', requireAuth, async (req, res) => {
  try {
    const { bookingId, description, openid, payType, wxCode } = req.body || {};
    
    if (!bookingId) {
      return fail(res, 400, '缺少 bookingId');
    }
    
    const booking = db.getBookings().find(b => b.id === bookingId);
    if (!booking) {
      return fail(res, 404, '预约不存在');
    }
    
    if (req.user.role !== 'parent' && req.user.role !== 'admin') {
      return fail(res, 403, '只有家长可以支付');
    }
    
    if (req.user.role === 'parent') {
      const parent = db.getParents().find(p => p.id === req.user.userId);
      if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
        return fail(res, 403, '只能支付自己的预约');
      }
    }

    const payable = pricing.isBookingPayable(booking);
    if (!payable.ok) {
      return fail(res, 400, payable.error);
    }

    const amountFen = payable.amountFen;

    let resolvedOpenid = openid;
    if (wxCode) {
      const session = await wechatSession.code2Session(wxCode);
      resolvedOpenid = session.openid;
      if (req.user.role === 'parent') {
        const parents = db.getParents();
        const parent = parents.find((p) => p.id === req.user.userId);
        if (parent) {
          db.saveParent(Object.assign({}, parent, { wechatOpenid: session.openid }));
        }
      }
    } else if (!resolvedOpenid && req.user.role === 'parent') {
      const parent = db.getParents().find((p) => p.id === req.user.userId);
      resolvedOpenid = parent && parent.wechatOpenid;
    }

    const resolvedPayType = payType || (resolvedOpenid ? 'JSAPI' : 'NATIVE');

    const result = await wechatPay.createPrepay({
      bookingId,
      amount: amountFen,
      description: description || '星火学伴 · 课程预约',
      openid: resolvedOpenid,
      payType: resolvedPayType
    });

    if (result && result.outTradeNo) {
      const payOrder = db.savePayOrder({
        outTradeNo: result.outTradeNo,
        prepayId: result.prepayId,
        bookingId,
        amount: amountFen,
        amountYuan: payable.amountYuan,
        description: description || '星火学伴 · 课程预约',
        status: 'NOTPAY',
        mock: !!result.mock,
        createTime: new Date().toISOString()
      });
      wechatPay.registerMockOrder(payOrder);
    }
    
    ok(res, Object.assign({}, result, { amountFen, amountYuan: payable.amountYuan }));
  } catch (error) {
    console.error('[WeChat Pay Prepay Error]', error);
    fail(res, 500, error.message || '创建预支付订单失败');
  }
});

app.post('/api/pay/wechat/notify', async (req, res) => {
  let lockedTradeNo = null;
  try {
    const body = req.body;
    const headers = req.headers;
    const rawBody = req.rawBody;

    const result = await wechatPay.handlePaymentNotify(body, headers, rawBody);

    if (result.tradeState === 'SUCCESS' && result.outTradeNo) {
      const outTradeNo = result.outTradeNo;
      if (notifyLocks.has(outTradeNo)) {
        return res.json({ code: 'SUCCESS', message: '处理中' });
      }
      notifyLocks.add(outTradeNo);
      lockedTradeNo = outTradeNo;

      const payOrder = db.getPayOrder(outTradeNo);
      if (!payOrder) {
        console.error(`[WeChat Pay Notify] 本地未找到订单: ${outTradeNo}`);
        return res.status(404).json({ code: 'FAIL', message: '订单不存在' });
      }

      const applied = applyWeChatPaySuccess(payOrder, result);
      if (!applied.ok) {
        return res.status(applied.http || 400).json({ code: 'FAIL', message: applied.message });
      }
    }

    res.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    console.error('[WeChat Pay Notify Error]', error);
    res.status(400).json({ code: 'FAIL', message: error.message });
  } finally {
    if (lockedTradeNo) notifyLocks.delete(lockedTradeNo);
  }
});

// Mock 支付确认（仅开发/测试环境）
app.post('/api/pay/wechat/mock-confirm', requireAuth, (req, res) => {
  try {
    if (!wechatPay.isMockPayAllowed()) {
      return fail(res, 403, '生产环境不允许模拟支付');
    }
    
    const { outTradeNo } = req.body || {};
    
    if (!outTradeNo) {
      return fail(res, 400, '缺少 outTradeNo');
    }
    
    const payOrder = db.getPayOrder(outTradeNo);
    if (!payOrder) {
      return fail(res, 404, '订单不存在');
    }

    const booking = db.getBookings().find(b => b.id === payOrder.bookingId);
    if (!booking) {
      return fail(res, 404, '预约不存在');
    }

    if (req.user.role === 'parent') {
      const parent = db.getParents().find(p => p.id === req.user.userId);
      if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
        return fail(res, 403, '只能确认自己的订单');
      }
    } else if (req.user.role !== 'admin') {
      return fail(res, 403, '无权限确认支付');
    }

    const payable = pricing.isBookingPayable(booking);
    if (!payable.ok) {
      return fail(res, 400, payable.error);
    }

    if (Number(payOrder.amount) !== payable.amountFen) {
      return fail(res, 400, '订单金额与预约不一致');
    }

    if (payOrder.status === 'SUCCESS' || booking.paymentStatus === 'paid') {
      return fail(res, 400, '订单已支付');
    }

    wechatPay.registerMockOrder(payOrder);

    const result = wechatPay.mockConfirmPayment(outTradeNo);
    
    if (!result.success) {
      return fail(res, 400, result.error || '确认失败');
    }

    if (result.bookingId !== payOrder.bookingId) {
      return fail(res, 400, '订单与预约不匹配');
    }

    db.savePayOrder({
      outTradeNo,
      status: 'SUCCESS',
      transactionId: result.transactionId,
      successTime: result.successTime || new Date().toISOString()
    });
      
    db.updateBooking(booking.id, {
      paymentStatus: 'paid',
      paymentMethod: 'wechat',
      paidAt: new Date().toISOString(),
      transactionId: result.transactionId,
      escrowStatus: 'frozen',
      amount: payable.amountYuan
    }, { trust: 'payment' });
    
    ok(res, result);
  } catch (error) {
    console.error('[Mock Pay Error]', error);
    fail(res, 500, error.message);
  }
});

app.get('/api/pay/orders', requireAdmin, (req, res) => {
  try {
    const orders = db.listPayOrders(req.query || {});
    ok(res, { orders, total: orders.length });
  } catch (error) {
    console.error('[List Pay Orders Error]', error);
    fail(res, 500, '查询订单列表失败');
  }
});

app.post('/api/pay/orders/:outTradeNo/refund', requireAdmin, async (req, res) => {
  try {
    const { outTradeNo } = req.params;
    const body = req.body || {};
    const payOrder = db.getPayOrder(outTradeNo);
    if (!payOrder) {
      return fail(res, 404, '订单不存在');
    }
    const wxRefund = await executeWeChatRefundForOrder(payOrder, body.reason || '管理员退款');
    if (!wxRefund.ok) {
      return fail(res, 400, wxRefund.error || '微信退款失败');
    }
    const result = db.refundPayOrder(outTradeNo, {
      reason: body.reason || '',
      refundedBy: req.user.phone || req.user.userId || 'admin',
      refundId: wxRefund.wx && wxRefund.wx.refundId,
      wxStatus: (wxRefund.wx && wxRefund.wx.status) || wxRefund.status
    });
    if (!result.ok) {
      return fail(res, 400, result.error);
    }
    ok(res, result);
  } catch (error) {
    console.error('[Refund Error]', error);
    fail(res, 500, error.message || '退款失败');
  }
});

app.post('/api/pay/wechat/sync', requireAuth, async (req, res) => {
  try {
    const outTradeNo = (req.body && req.body.outTradeNo) || req.query.outTradeNo;
    if (!outTradeNo) {
      return fail(res, 400, '缺少 outTradeNo');
    }
    const payOrder = db.getPayOrder(outTradeNo);
    if (!payOrder) {
      return fail(res, 404, '订单不存在');
    }
    const access = bookingForPayOrderAccess(req, res, payOrder, outTradeNo);
    if (!access.allowed) return;
    const result = await syncPayOrderWithRemote(outTradeNo);
    if (!result.ok) {
      return fail(res, 404, result.error || '同步失败');
    }
    ok(res, Object.assign({ success: true }, result));
  } catch (error) {
    console.error('[WeChat Pay Sync Error]', error);
    fail(res, 500, error.message || '同步支付状态失败');
  }
});

app.get('/api/pay/orders/:outTradeNo', requireAuth, async (req, res) => {
  try {
    const { outTradeNo } = req.params;
    const payOrder = db.getPayOrder(outTradeNo);
    const access = bookingForPayOrderAccess(req, res, payOrder, outTradeNo);
    if (!access.allowed) return;

    if (req.query.sync === '1' || req.query.sync === 'true') {
      const result = await syncPayOrderWithRemote(outTradeNo);
      if (!result.ok) {
        return fail(res, 404, result.error || '同步失败');
      }
      return ok(res, Object.assign({ success: true }, result));
    }

    const result = wechatPay.getOrderStatus(outTradeNo);
    if (payOrder) {
      result.bookingId = payOrder.bookingId;
      result.status = payOrder.status || result.status;
    }
    ok(res, result);
  } catch (error) {
    console.error('[Get Order Error]', error);
    fail(res, 500, '查询订单失败');
  }
});

/* Mentors */
app.get('/api/mentors', requireAuth, (req, res) => {
  db.seedIfEmpty();
  
  // 管理员可以看所有导师完整信息
  if (req.user.role === 'admin') {
    ok(res, db.getMentors());
  } else if (req.user.role === 'parent') {
    // 家长可以看已审核的导师列表，但只返回公开信息（不含手机号等敏感字段）
    const mentors = db.getMentors()
      .filter(m => m.status === 'approved' && m.acceptingOrders !== false)
      .map(publicMentorProfile);
    ok(res, mentors);
  } else if (req.user.role === 'mentor') {
    // 导师只能看自己的完整信息
    const mentor = db.getMentorById(req.user.userId);
    ok(res, mentor ? [mentor] : []);
  } else {
    fail(res, 403, '无权限');
  }
});

app.post('/api/mentors', requireAuth, (req, res) => {
  if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
    return fail(res, 403, '无权限');
  }
  const body = Object.assign({}, req.body || {});
  if (req.user.role !== 'admin') {
    body.id = req.user.userId;
    body.phone = req.user.phone;
    MENTOR_PRIVILEGED_PATCH_KEYS.forEach((k) => {
      if (k !== 'id' && k !== 'phone') delete body[k];
    });
    delete body.status;
    delete body.evalGrade;
    delete body.reviewComment;
    delete body.code;
    delete body.sensitiveChangePending;
  }
  const mentor = db.addMentor(body);
  ok(res, mentor);
});

app.get('/api/mentors/phone/:phone', requireAuth, (req, res) => {
  // 只有管理员可以通过手机号查询
  if (req.user.role !== 'admin') {
    return fail(res, 403, '无权限');
  }
  
  const m = db.getMentorByPhone(req.params.phone);
  if (!m) return fail(res, 404, 'mentor not found');
  ok(res, m);
});

app.get('/api/mentors/:id', requireAuth, (req, res) => {
  const m = db.getMentorById(req.params.id);
  if (!m) return fail(res, 404, 'mentor not found');
  
  // 家长可以看已审核的导师公开信息
  if (req.user.role === 'parent') {
    if (m.status !== 'approved') {
      return fail(res, 403, '无权限');
    }
    return ok(res, publicMentorProfile(m));
  }
  
  // 导师只能看自己的完整信息
  if (req.user.role === 'mentor' && req.user.userId !== m.id) {
    return fail(res, 403, '只能查看自己的资料');
  }
  
  // 导师看自己或管理员看所有，返回完整信息
  ok(res, m);
});

app.patch('/api/mentors/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin' && req.user.userId !== req.params.id) {
    return fail(res, 403, '只能修改自己的资料');
  }

  const existing = db.getMentorById(req.params.id);
  if (!existing) return fail(res, 404, 'mentor not found');

  const body = req.body || {};
  const options = Object.assign({}, body._options || {});
  const patch = Object.assign({}, body);
  delete patch._options;
  delete patch.id;

  if (req.user.role !== 'admin') {
    MENTOR_PRIVILEGED_PATCH_KEYS.forEach((k) => {
      delete patch[k];
    });
    const touchedSensitive = MENTOR_SENSITIVE_KEYS.some((k) => {
      if (patch[k] === undefined) return false;
      try {
        return JSON.stringify(patch[k]) !== JSON.stringify(existing[k]);
      } catch (_) {
        return true;
      }
    });
    if (touchedSensitive) {
      options.sensitiveChange = true;
    }
  }

  const updated = db.updateMentor(req.params.id, patch, options);
  if (!updated) return fail(res, 404, 'mentor not found');
  ok(res, updated);
});

/* Parents */
app.get('/api/parents', requireAuth, (req, res) => {
  db.seedIfEmpty();
  
  // 只有管理员可以看所有家长
  if (req.user.role === 'admin') {
    ok(res, db.getParents());
  } else if (req.user.role === 'parent') {
    // 家长只能看自己
    const parent = db.getParents().find(p => p.id === req.user.userId);
    ok(res, parent ? [parent] : []);
  } else {
    fail(res, 403, '无权限');
  }
});

app.post('/api/parents', requireAuth, (req, res) => {
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return fail(res, 403, '无权限');
  }
  const body = Object.assign({}, req.body || {});
  if (req.user.role === 'parent') {
    body.id = req.user.userId;
    body.phone = req.user.phone;
  }
  const parent = db.saveParent(body);
  ok(res, parent);
});

app.get('/api/parents/phone/:phone', requireAuth, (req, res) => {
  // 只有管理员可以通过手机号查询
  if (req.user.role !== 'admin') {
    return fail(res, 403, '无权限');
  }
  
  const p = db.getParentByPhone(req.params.phone);
  if (!p) return fail(res, 404, 'parent not found');
  ok(res, p);
});

/* Bookings */
app.get('/api/bookings', requireAuth, (req, res) => {
  db.seedIfEmpty();
  
  const allBookings = db.getBookings();
  
  // 根据角色过滤预约
  if (req.user.role === 'admin') {
    ok(res, allBookings);
  } else if (req.user.role === 'parent') {
    // 家长只能看自己的预约
    const parent = db.getParents().find(p => p.id === req.user.userId);
    if (!parent) return fail(res, 404, '用户不存在');
    
    const myBookings = allBookings.filter(b => 
      b.parentId === parent.id || b.parentPhone === parent.phone
    );
    ok(res, myBookings);
  } else if (req.user.role === 'mentor') {
    // 导师只能看自己的预约，家长手机号脱敏
    const myBookings = allBookings
      .filter(b => b.mentorId === req.user.userId || b.tutorId === req.user.userId)
      .map(b => ({
        ...b,
        parentPhone: b.parentPhone ? maskPhone(b.parentPhone) : ''
      }));
    ok(res, myBookings);
  } else {
    fail(res, 403, '无权限');
  }
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  // 只有家长可以创建预约
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return fail(res, 403, '只有家长可以创建预约');
  }
  
  const bookingData = req.body || {};
  
  // 确保预约的 parentId 是当前用户
  if (req.user.role === 'parent') {
    bookingData.parentId = req.user.userId;
    const parent = db.getParents().find(p => p.id === req.user.userId);
    if (parent) {
      bookingData.parentPhone = parent.phone;
    }
  }
  
  const booking = db.addBooking(bookingData);

  if (booking && booking.ok === false) {
    return res.status(400).json({
      ok: false,
      error: booking.error || '创建预约失败',
      code: booking.code,
      conflicts: booking.conflicts
    });
  }
  if (!booking || !booking.id) {
    return fail(res, 400, '创建预约失败');
  }
  
  // 新约课待接单：短信通知导师（失败不影响创建）
  if (booking && booking.id) {
    try {
      await bookingSmsNotify.notifyBookingCreated(booking, db);
    } catch (error) {
      console.error('[Booking SMS Notification Error]', error);
    }
  }
  
  ok(res, booking);
});

app.patch('/api/bookings/:id', requireAuth, (req, res) => {
  const booking = db.getBookings().find(b => b.id === req.params.id);
  if (!booking) return fail(res, 404, 'booking not found');
  
  // 检查权限：家长和导师只能修改自己的预约，管理员可以修改所有
  if (req.user.role !== 'admin') {
    if (req.user.role === 'parent') {
      const parent = db.getParents().find(p => p.id === req.user.userId);
      if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
        return fail(res, 403, '只能修改自己的预约');
      }
    } else if (req.user.role === 'mentor') {
      if (booking.mentorId !== req.user.userId && booking.tutorId !== req.user.userId) {
        return fail(res, 403, '只能修改自己的预约');
      }
    }
  }
  
  const trust = req.user.role === 'admin' ? 'admin' : null;
  const updated = db.updateBooking(req.params.id, req.body || {}, {
    trust,
    role: req.user.role
  });
  if (!updated) return fail(res, 404, 'booking not found');
  ok(res, updated);
});

app.post('/api/bookings/:id/respond', requireAuth, async (req, res) => {
  // 只有导师可以响应预约
  if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
    return fail(res, 403, '只有导师可以响应预约');
  }
  
  const booking = db.getBookings().find(b => b.id === req.params.id);
  if (!booking) return fail(res, 404, 'booking not found');
  
  // 导师只能响应自己的预约
  if (req.user.role === 'mentor') {
    if (booking.mentorId !== req.user.userId && booking.tutorId !== req.user.userId) {
      return fail(res, 403, '只能响应自己的预约');
    }
  }
  
  const updated = db.respondToBooking(req.params.id, req.body || {});
  if (!updated) return fail(res, 404, 'booking not found');

  try {
    await bookingSmsNotify.notifyBookingRespond(updated, req.body || {}, db);
  } catch (error) {
    console.error('[Booking Respond SMS Error]', error);
  }

  ok(res, updated);
});


app.post('/api/bookings/:id/cancel', requireAuth, async (req, res) => {
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return fail(res, 403, '仅家长可撤销约课');
  }
  const booking = db.getBookings().find((b) => b.id === req.params.id);
  if (!booking) return fail(res, 404, 'booking not found');

  let parentRef = null;
  if (req.user.role === 'parent') {
    parentRef = db.getParents().find((p) => p.id === req.user.userId);
    if (!parentRef) return fail(res, 403, '家长档案不存在');
  } else {
    parentRef = db.getParents().find(
      (p) => p.id === booking.parentId || p.phone === booking.parentPhone
    );
  }

  const validated = db.validateParentCancelBooking(
    req.params.id,
    parentRef || { id: booking.parentId }
  );
  if (!validated.ok) {
    return res.status(400).json(validated);
  }

  const payOrder = validated.payOrder;
  let refundNotice = null;
  if (payOrder && payOrder.outTradeNo) {
    const wxRefund = await executeWeChatRefundForOrder(payOrder, '家长开课前撤销');
    if (!wxRefund.ok) {
      return fail(res, 400, wxRefund.error || '微信原路退款失败，约课未撤销');
    }
    const dbRefund = db.refundPayOrder(payOrder.outTradeNo, {
      reason: '家长开课前撤销',
      refundedBy: validated.parentPhone || validated.parentId || 'parent',
      refundId: wxRefund.wx && wxRefund.wx.refundId,
      wxStatus: (wxRefund.wx && wxRefund.wx.status) || wxRefund.status
    });
    if (!dbRefund.ok) {
      return fail(res, 400, dbRefund.error || '退款记账失败');
    }
    refundNotice = {
      amountYuan: payOrder.amountYuan,
      outTradeNo: payOrder.outTradeNo,
      mock: !!wxRefund.mock
    };
  }

  const result = db.parentCancelBooking(req.params.id, parentRef || { id: booking.parentId }, {
    skipRefund: true
  });
  if (!result || !result.ok) {
    return res.status(400).json(result || { ok: false, error: 'cancel failed' });
  }

  const notifyPhone = booking.parentPhone || (parentRef && parentRef.phone);
  if (notifyPhone) {
    try {
      await sms.sendRefundNotification(notifyPhone, {
        subject: booking.subject || '课程',
        schedule: booking.schedule || '',
        amountYuan: refundNotice && refundNotice.amountYuan != null
          ? refundNotice.amountYuan
          : booking.amount,
        reason: '家长开课前撤销',
        refunded: !!(payOrder && payOrder.outTradeNo)
      });
    } catch (error) {
      console.error('[Cancel Refund SMS Error]', error);
    }
  }

  try {
    await bookingSmsNotify.notifyParentCancel(booking, db);
  } catch (error) {
    console.error('[Cancel Mentor SMS Error]', error);
  }

  ok(res, Object.assign({}, result, { refund: refundNotice }));
});

app.get('/api/parents/me/wallet', requireAuth, (req, res) => {
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return fail(res, 403, '无权限');
  }
  try {
    const parent =
      req.user.role === 'parent'
        ? db.getParents().find((p) => p.id === req.user.userId)
        : null;
    if (req.user.role === 'parent' && !parent) {
      return fail(res, 404, '家长档案不存在');
    }
    const bookings = db.getBookings();
    const summary = pricing.computeParentWalletFromBookings(
      bookings,
      parent || { id: req.user.userId }
    );
    ok(res, summary);
  } catch (error) {
    console.error('[Parent Wallet Error]', error);
    fail(res, 500, '查询托管摘要失败');
  }
});

app.post('/api/bookings/:id/leave', requireAuth, (req, res) => {
  const booking = db.getBookings().find(b => b.id === req.params.id);
  if (!booking) return fail(res, 404, 'booking not found');
  
  // 检查权限
  if (req.user.role !== 'admin') {
    if (req.user.role === 'parent') {
      const parent = db.getParents().find(p => p.id === req.user.userId);
      if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
        return fail(res, 403, '无权限');
      }
    } else if (req.user.role === 'mentor') {
      if (booking.mentorId !== req.user.userId && booking.tutorId !== req.user.userId) {
        return fail(res, 403, '无权限');
      }
    }
  }
  
  const body = req.body || {};
  const sessionId = body.sessionId;
  const action = body.action || 'request';
  let result;
  if (action === 'confirm' || action === 'approve' || action === 'reject') {
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
      return fail(res, 403, '仅导师或管理员可审批请假申请');
    }
    const isApprove = action === 'confirm' || action === 'approve';
    result = db.confirmSessionLeave(req.params.id, sessionId, isApprove);
  } else {
    result = db.requestSessionLeave(req.params.id, sessionId, req.user.role || 'parent');
  }
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'leave failed' });
  }
  ok(res, result);
});

app.post('/api/bookings/:id/complete', requireAuth, (req, res) => {
  // 只有导师可以完成课程
  if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
    return fail(res, 403, '只有导师可以完成课程');
  }
  
  const booking = db.getBookings().find(b => b.id === req.params.id);
  if (!booking) return fail(res, 404, 'booking not found');
  
  // 导师只能完成自己的课程
  if (req.user.role === 'mentor') {
    if (booking.mentorId !== req.user.userId && booking.tutorId !== req.user.userId) {
      return fail(res, 403, '只能完成自己的课程');
    }
  }
  
  const body = req.body || {};
  const result = db.completeSession(req.params.id, body.sessionId, {
    completedBy: body.completedBy || 'mentor',
    classSummary: body.classSummary || null,
    mentorId: body.mentorId || req.user.userId
  });
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'complete failed' });
  }
  ok(res, result);
});

app.post('/api/bookings/:id/parent-message', requireAuth, (req, res) => {
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return fail(res, 403, '只有家长可以留言');
  }

  const booking = db.getBookings().find((b) => b.id === req.params.id);
  if (!booking) return fail(res, 404, 'booking not found');

  if (req.user.role === 'parent') {
    const parent = db.getParents().find((p) => p.id === req.user.userId);
    if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
      return fail(res, 403, '只能为自己的预约留言');
    }
  }

  const body = req.body || {};
  const sessionId = body.sessionId;
  if (!sessionId) {
    return fail(res, 400, '缺少 sessionId');
  }

  const parentId = req.user.role === 'parent' ? req.user.userId : booking.parentId;
  const result = db.saveParentMessage(
    req.params.id,
    sessionId,
    body.parentMessage || body.message || body,
    parentId
  );
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: '留言失败' });
  }
  ok(res, result);
});

app.post('/api/bookings/:id/summary', requireAuth, (req, res) => {
  // 只有导师可以提交课后小结
  if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
    return fail(res, 403, '只有导师可以提交课后小结');
  }
  
  const booking = db.getBookings().find(b => b.id === req.params.id);
  if (!booking) return fail(res, 404, 'booking not found');
  
  // 导师只能提交自己的课后小结
  if (req.user.role === 'mentor') {
    if (booking.mentorId !== req.user.userId && booking.tutorId !== req.user.userId) {
      return fail(res, 403, '只能提交自己的课后小结');
    }
  }
  
  const body = req.body || {};
  const result = db.saveClassSummary(req.params.id, body.sessionId, body.classSummary || body, body.mentorId || req.user.userId);
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'summary failed' });
  }
  ok(res, result);
});

app.post('/api/mentors/:id/availability', requireAuth, (req, res) => {
  // 只能修改自己的可用时间，或管理员可以修改任何人
  if (req.user.role !== 'admin' && req.user.userId !== req.params.id) {
    return fail(res, 403, '只能修改自己的可用时间');
  }
  
  const updated = db.setMentorAvailability(req.params.id, (req.body && req.body.availability) || req.body || []);
  if (!updated) return fail(res, 404, 'mentor not found');
  ok(res, updated);
});

app.post('/api/bookings/process-escrow', requireAuth, (req, res) => {
  // 只有管理员可以处理托管释放
  if (req.user.role !== 'admin') {
    return fail(res, 403, '需要管理员权限');
  }
  
  ok(res, db.processEscrowReleases());
});

/* ========== Feedback ========== */
app.get('/api/feedback', requireAuth, (req, res) => {
  try {
    let tickets = db.getFeedbackTickets();
    if (req.user.role === 'admin') {
      return ok(res, tickets);
    }
    if (req.user.role === 'mentor') {
      tickets = tickets.filter((t) => t.mentorId === req.user.userId);
      return ok(res, tickets);
    }
    if (req.user.role === 'parent') {
      tickets = tickets.filter(
        (t) => t.parentId === req.user.userId || t.submitterId === req.user.userId
      );
      return ok(res, tickets);
    }
    return fail(res, 403, '无权限');
  } catch (error) {
    console.error('[Feedback List Error]', error);
    fail(res, 500, '查询反馈失败');
  }
});

function buildFeedbackCreateFromRequest(req) {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const detail = String(body.detail || body.content || '').trim();
  const payload = {
    title,
    detail,
    type: body.type ? String(body.type).trim() : '功能问题',
    bookingId: body.bookingId ? String(body.bookingId).trim() : '',
    contact: body.contact ? String(body.contact).trim() : '',
    submitterId: req.user.userId,
    submitterRole: req.user.role
  };

  if (req.user.role === 'admin') {
    if (body.mentorId) payload.mentorId = String(body.mentorId).trim();
    if (body.parentId) payload.parentId = String(body.parentId).trim();
    if (body.mentorName) payload.mentorName = String(body.mentorName).trim();
  } else if (req.user.role === 'mentor') {
    const mentor = db.getMentorById(req.user.userId);
    payload.mentorId = req.user.userId;
    payload.mentorName = mentor ? mentor.realName || '导师' : '导师';
  } else if (req.user.role === 'parent') {
    payload.parentId = req.user.userId;
    const parent = db.getParents().find((p) => p.id === req.user.userId);
    if (parent && !payload.contact) payload.contact = parent.phone || '';
  }

  return payload;
}

app.post('/api/feedback', requireAuth, (req, res) => {
  try {
    const payload = buildFeedbackCreateFromRequest(req);
    if (!payload.title || !payload.detail) {
      return fail(res, 400, '缺少标题或详细说明');
    }
    const record = db.addFeedbackTicket(payload);
    ok(res, record);
  } catch (error) {
    console.error('[Feedback Create Error]', error);
    fail(res, 500, '提交反馈失败');
  }
});

app.patch('/api/feedback/:id', requireAdmin, (req, res) => {
  try {
    const updated = db.updateFeedbackTicket(req.params.id, req.body || {});
    if (!updated) return fail(res, 404, '反馈不存在');
    ok(res, updated);
  } catch (error) {
    console.error('[Feedback Update Error]', error);
    fail(res, 500, '更新反馈失败');
  }
});

/* ========== Subject catalog & teaching points ========== */
const subjectCatalog = require('./subject-catalog');

app.get('/api/subject-catalog', (req, res) => {
  ok(res, subjectCatalog.getSubjectCatalog());
});

/* ========== Proof file uploads (mini program + web) ========== */
proofUpload.ensureDirs();

function setUploadSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', isProduction ? 'private, max-age=604800' : 'no-store');
}

function resolveProofAccessUser(req) {
  const q = req.query || {};
  const queryToken = q.access_token || q.token || '';
  const headerToken = auth.extractTokenFromRequest(req);
  const token = headerToken || String(queryToken || '').trim();
  const user = auth.verifyToken(token, db);
  if (user) return user;
  const adminToken = process.env.ADMIN_TOKEN;
  const provided = String(req.headers['x-admin-token'] || '').trim();
  if (adminToken && provided && auth.safeCompare(provided, adminToken)) {
    return { userId: 'ADMIN-STATIC', role: 'admin', phone: '' };
  }
  return null;
}

function mentorOwnsProof(mentor, storedName) {
  if (!mentor || !storedName) return false;
  const files = mentor.proofFiles || [];
  return files.some((f) => {
    if (!f) return false;
    if (f.id === storedName) return true;
    if (f.url && String(f.url).endsWith('/' + storedName)) return true;
    if (f.path && String(f.path).endsWith(storedName)) return true;
    return false;
  });
}

function canAccessProof(user, storedName, meta) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (meta && meta.ownerId && meta.ownerId === user.userId) return true;
  if (user.role === 'mentor') {
    const mentor = db.getMentorById(user.userId) || db.getMentorByPhone(user.phone);
    if (mentorOwnsProof(mentor, storedName)) return true;
  }
  return false;
}

app.get('/uploads/proofs/:file', (req, res) => {
  setUploadSecurityHeaders(res);
  const resolved = proofUpload.resolveProofFile(req.params.file);
  if (!resolved.ok) {
    return fail(res, 404, 'file not found');
  }
  const user = resolveProofAccessUser(req);
  if (!canAccessProof(user, resolved.storedName, resolved.meta)) {
    return fail(res, user ? 403 : 401, user ? '无权限查看该佐证材料' : '未登录或会话已过期');
  }
  res.setHeader('Content-Type', resolved.mimeType);
  res.sendFile(resolved.absPath);
});

app.use('/uploads', (req, res) => {
  setUploadSecurityHeaders(res);
  fail(res, 404, 'not found');
});

app.post(
  '/api/uploads/proof',
  requireAuth,
  express.raw({ type: () => true, limit: '12mb' }),
  (req, res) => {
    try {
      if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
        return fail(res, 403, '仅导师或管理员可上传佐证材料');
      }
      const contentType = req.headers['content-type'] || '';
      if (!contentType.toLowerCase().includes('multipart/form-data')) {
        return fail(res, 400, '请使用 multipart 上传文件');
      }
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const { fields, file } = proofUpload.parseMultipart(body, contentType);
      const result = proofUpload.saveProofUpload(file, fields, req.user);
      if (!result.ok) {
        return fail(res, 400, result.error || '上传失败');
      }
      ok(res, { file: result.record });
    } catch (error) {
      console.error('[Proof Upload Error]', error);
      fail(res, 400, '上传解析失败');
    }
  }
);

app.get('/api/teaching-points', requireAuth, (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getTeachingPoints());
});

app.get('/api/admin/teaching-points', requireAdmin, (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getTeachingPoints());
});

app.patch('/api/admin/teaching-points/:id', requireAdmin, (req, res) => {
  db.seedIfEmpty();
  const body = req.body || {};
  const boothCount = body.boothCount != null ? body.boothCount : body.booth_count;
  const result = db.updateTeachingPointBoothCount(req.params.id, boothCount);
  if (result && result.ok === false) {
    return res.status(400).json({
      ok: false,
      error: result.error,
      code: result.code,
      bookingIds: result.bookingIds
    });
  }
  ok(res, result.teachingPoint);
});

app.get('/api/admin/teaching-points/:id/occupancy', requireAdmin, (req, res) => {
  db.seedIfEmpty();
  const result = db.getTeachingPointOccupancy(req.params.id, {
    date: req.query.date,
    weekday: req.query.weekday
  });
  if (result && result.ok === false) {
    return fail(res, 404, result.error || '教学点不存在');
  }
  ok(res, result);
});

/* ========== Feature flags ========== */
app.get('/api/feature-flags', (req, res) => {
  ok(res, db.getPublicFeatureFlags());
});

app.get('/api/admin/feature-flags', requireAdmin, (req, res) => {
  ok(res, db.getFeatureFlags());
});

app.patch('/api/admin/feature-flags', requireAdmin, (req, res) => {
  try {
    const flags = db.updateFeatureFlags(req.body || {});
    ok(res, flags);
  } catch (error) {
    console.error('[Feature Flags Error]', error);
    fail(res, 500, '更新功能开关失败');
  }
});


/* Assessments */
app.get('/api/assessments', requireAuth, (req, res) => {
  db.seedIfEmpty();
  
  const allAssessments = db.getAssessments();
  
  // 根据角色过滤
  if (req.user.role === 'admin') {
    ok(res, allAssessments);
  } else if (req.user.role === 'parent') {
    // 家长只能看自己的测评
    const parent = db.getParents().find(p => p.id === req.user.userId);
    if (!parent) return fail(res, 404, '用户不存在');
    
    const myAssessments = allAssessments.filter(a => 
      a.parentId === parent.id || a.parentPhone === parent.phone
    );
    ok(res, myAssessments);
  } else {
    fail(res, 403, '无权限');
  }
});

app.post('/api/assessments', requireAuth, (req, res) => {
  // 只有家长可以创建测评
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return fail(res, 403, '只有家长可以创建测评');
  }
  
  const assessmentData = req.body || {};
  
  // 确保测评的 parentId 是当前用户
  if (req.user.role === 'parent') {
    assessmentData.parentId = req.user.userId;
    const parent = db.getParents().find(p => p.id === req.user.userId);
    if (parent) {
      assessmentData.parentPhone = parent.phone;
    }
  }
  
  const record = db.saveAssessment(assessmentData);
  if (!record) return fail(res, 400, 'invalid assessment');
  ok(res, record);
});

/* Contracts */
app.get('/api/contracts', requireAuth, (req, res) => {
  db.seedIfEmpty();
  const all = db.getContracts();

  if (req.user.role === 'admin') {
    return ok(res, all);
  }

  if (req.user.role === 'parent') {
    const parentId = req.user.userId;
    const parent = db.getParents().find((p) => p.id === parentId);
    const filtered = all.filter(
      (c) => c.parentId === parentId || (parent && c.parentPhone && c.parentPhone === parent.phone)
    );
    return ok(res, filtered);
  }

  if (req.user.role === 'mentor') {
    const mentorId = req.user.userId;
    const bookingIds = new Set(
      db.getBookings()
        .filter((b) => b.mentorId === mentorId || b.tutorId === mentorId)
        .map((b) => b.id)
    );
    const filtered = all.filter(
      (c) =>
        c.mentorId === mentorId ||
        c.tutorId === mentorId ||
        (c.bookingId && bookingIds.has(c.bookingId))
    );
    return ok(res, filtered);
  }

  return fail(res, 403, '无权限');
});

app.post('/api/contracts', requireAuth, (req, res) => {
  db.seedIfEmpty();
  const body = req.body || {};

  if (req.user.role === 'admin') {
    return ok(res, db.saveContract(body));
  }

  if (req.user.role === 'parent') {
    const parentId = req.user.userId;
    const parent = db.getParents().find((p) => p.id === parentId);
    if (!parent) {
      return fail(res, 404, '用户不存在');
    }

    const bookingId = body.bookingId;
    if (!bookingId) {
      return fail(res, 400, '缺少 bookingId');
    }

    const booking = db.getBookings().find((b) => b.id === bookingId);
    if (!booking) {
      return fail(res, 404, '预约不存在');
    }

    if (booking.parentId !== parent.id && booking.parentPhone !== parent.phone) {
      return fail(res, 403, '只能为自己的预约签署合约');
    }

    const mentor = db.getMentorById(booking.mentorId || booking.tutorId);
    const record = db.saveContract({
      title: body.title || '三方托管服务居间协议',
      signer: body.signer,
      tutorName: booking.tutorName || (mentor && mentor.realName) || '',
      amount: pricing.bookingAmountYuan(booking),
      space: booking.space || '',
      bookingId,
      parentId: parent.id,
      parentPhone: parent.phone,
      mentorId: booking.mentorId || booking.tutorId,
      tutorId: booking.tutorId || booking.mentorId
    });
    return ok(res, record);
  }

  return fail(res, 403, '无权限');
});

/* Session - 已废弃，保留兼容 */
app.get('/api/session', (req, res) => {
  // 返回空对象，会话现在由令牌管理
  ok(res, {});
});

app.put('/api/session', (req, res) => {
  // 不再更新，会话现在由令牌管理
  ok(res, {});
});

/* Tutor match */
app.post('/api/tutors/match', requireAuth, (req, res) => {
  // 只有家长和管理员可以匹配导师
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return fail(res, 403, '只有家长可以匹配导师');
  }
  
  const tutors = db.matchTutors(req.body || {});
  ok(res, tutors);
});

app.use((req, res) => {
  fail(res, 404, 'not found: ' + req.method + ' ' + req.path);
});

db.seedIfEmpty();
wechatPay.hydrateMockOrders(db.getPayOrders());

app.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log(`  星火学伴 · API Server`);
  console.log('='.repeat(60));
  console.log(`  Environment:  ${NODE_ENV}`);
  console.log(`  Listening:    http://${HOST}:${PORT}`);
  console.log(`  Database:     ${db.DB_PATH}`);
  console.log(`  CORS:         ${isProduction ? corsOrigins.join(', ') : '*'}`);
  console.log('');
  console.log('  短信服务:');
  console.log(`    Provider:   ${sms.getProvider()}`);
  sms.warnDevOtpAtStartup();
  if (sms.isDevOtpEnabled()) {
    console.log(
      `    Status:     ⚠️  DEV OTP ON (code=${sms.getDevOtpCode()}, ALLOW_DEV_OTP=true${
        isProduction ? ', 生产环境管理员已禁用' : ''
      })`
    );
  } else {
    console.log(`    Status:     ${sms.getProvider() === 'mock' ? '演示模式 (非生产可用 888888)' : '生产模式'}`);
  }
  console.log('');
  console.log('  微信支付:');
  console.log(`    配置状态:   ${wechatPay.isConfigComplete() ? '✓ 已配置' : '✗ 未配置'}`);
  console.log(`    Mock支付:   ${wechatPay.isMockPayAllowed() ? '✓ 允许' : '✗ 禁止'}`);
  console.log(
    `    验签模式:   ${
      wechatPay.isPublicKeyVerifyMode()
        ? '微信支付公钥 (WECHAT_PUBLIC_KEY_*)'
        : '平台证书 (/v3/certificates)'
    }`
  );
  console.log('');
  if (isProduction && !process.env.ADMIN_TOKEN) {
    console.log('  ⚠️  警告: 生产环境未设置 ADMIN_TOKEN');
  }
  console.log('='.repeat(60));
});
