/**
 * 星火学伴 · 统一库 API
 * 监听 0.0.0.0:8787，供网页与微信小程序共享读写
 */
'use strict';

// 加载环境变量
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./db');
const sms = require('./sms');
const auth = require('./auth');
const wechatPay = require('./wechat-pay');
const wechatPhone = require('./wechat-phone');
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

app.use(express.json({ limit: '8mb' }));
app.use(express.raw({ type: 'application/json', limit: '8mb' })); // For WeChat Pay callback

// 工具函数
function ok(res, data) {
  res.json(data);
}

function fail(res, status, message) {
  res.status(status).json({ error: message || 'error' });
}

// 工具函数：返回导师公开资料（隐藏敏感信息）
function publicMentorProfile(mentor) {
  const { phone, idCard, bankName, bankCardNumber, ...publicFields } = mentor;
  return publicFields;
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
    service: 'xinghuo-platform',
    version: '1.0.0',
    env: NODE_ENV,
    port: PORT,
    time: new Date().toISOString(),
    db: db.DB_PATH,
    sms: {
      provider: sms.getProvider(),
      available: true
    },
    payment: {
      wechat: {
        configured: wechatPay.isConfigComplete(),
        mockAllowed: wechatPay.isMockPayAllowed()
      }
    }
  });
});

// 获取数据库快照（需要管理员权限）
app.get('/api/snapshot', requireAdminToken, (req, res) => {
  db.seedIfEmpty();
  ok(res, db.snapshot());
});

// 危险操作：替换快照（生产环境需要 admin token）
app.post('/api/snapshot', requireAdminToken, (req, res) => {
  const body = req.body || {};
  ok(res, db.replaceSnapshot(body));
});

// 危险操作：重置数据库（生产环境需要 admin token）
app.post('/api/reset', requireAdminToken, (req, res) => {
  ok(res, db.reset());
});

/* ========== SMS 短信验证码 ========== */
app.post('/api/auth/sms/send', async (req, res) => {
  try {
    const { phone, scene } = req.body || {};
    
    if (!phone) {
      return fail(res, 400, '缺少手机号');
    }
    
    const result = await sms.sendSMS(phone, scene || 'login', auth);
    
    if (!result.success) {
      return res.status(429).json({
        error: result.error,
        retryAfter: result.retryAfter
      });
    }
    
    ok(res, {
      success: true,
      message: result.message,
      provider: result.provider,
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
app.post('/api/wx/phone', requireAuth, async (req, res) => {
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
    const phone = auth.verifyAndConsumeTicket(ticket);
    if (!phone) {
      return fail(res, 400, '验证票据无效或已过期');
    }
    
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

app.post('/api/auth/phone/audit', requireAuth, (req, res) => {
  try {
    const entry = Object.assign({}, req.body || {}, {
      userId: req.user.userId,
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
      ua: req.headers['user-agent'] || ''
    });
    
    db.logPhoneAudit(entry);
    ok(res, { success: true });
  } catch (error) {
    console.error('[Audit Log Error]', error);
    fail(res, 500, '记录失败');
  }
});

/* ========== 微信支付 ========== */
app.post('/api/pay/wechat/prepay', requireAuth, async (req, res) => {
  try {
    const { bookingId, amount, description, openid, payType } = req.body || {};
    
    if (!bookingId) {
      return fail(res, 400, '缺少 bookingId');
    }
    
    if (!amount || amount <= 0) {
      return fail(res, 400, '金额无效');
    }
    
    // 验证用户只能为自己的预约支付
    const booking = db.getBookings().find(b => b.id === bookingId);
    if (!booking) {
      return fail(res, 404, '预约不存在');
    }
    
    // 只有家长可以支付，且只能支付自己的预约
    if (req.user.role !== 'parent' && req.user.role !== 'admin') {
      return fail(res, 403, '只有家长可以支付');
    }
    
    if (req.user.role === 'parent') {
      const parent = db.getParents().find(p => p.id === req.user.userId);
      if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
        return fail(res, 403, '只能支付自己的预约');
      }
    }
    
    const result = await wechatPay.createPrepay({
      bookingId,
      amount,
      description: description || '星火学伴 · 课程预约',
      openid,
      payType: payType || 'JSAPI'
    });
    
    ok(res, result);
  } catch (error) {
    console.error('[WeChat Pay Prepay Error]', error);
    fail(res, 500, error.message || '创建预支付订单失败');
  }
});

app.post('/api/pay/wechat/notify', (req, res) => {
  try {
    const body = req.body;
    const headers = req.headers;
    
    const result = wechatPay.handlePaymentNotify(body, headers);
    
    // 更新订单状态
    if (result.tradeState === 'SUCCESS') {
      const booking = db.getBookings().find(b => 
        b.id === result.outTradeNo.split('-')[1] || 
        b.id.includes(result.outTradeNo.split('-')[1])
      );
      
      if (booking) {
        db.updateBooking(booking.id, {
          paymentStatus: 'paid',
          paymentMethod: 'wechat',
          paidAt: result.successTime,
          transactionId: result.transactionId,
          escrowStatus: 'frozen'
        });
      }
    }
    
    // 微信要求返回特定格式
    res.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    console.error('[WeChat Pay Notify Error]', error);
    res.json({ code: 'FAIL', message: error.message });
  }
});

// Mock 支付确认（仅开发/测试环境）
app.post('/api/pay/wechat/mock-confirm', requireAuth, (req, res) => {
  try {
    if (isProduction && !wechatPay.isMockPayAllowed()) {
      return fail(res, 403, '生产环境不允许模拟支付');
    }
    
    const { outTradeNo } = req.body || {};
    
    if (!outTradeNo) {
      return fail(res, 400, '缺少 outTradeNo');
    }
    
    const result = wechatPay.mockConfirmPayment(outTradeNo);
    
    if (!result.success) {
      return fail(res, 400, result.error);
    }
    
    // 验证用户只能确认自己的订单
    const booking = db.getBookings().find(b => b.id === result.bookingId);
    if (booking) {
      if (req.user.role === 'parent') {
        const parent = db.getParents().find(p => p.id === req.user.userId);
        if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
          return fail(res, 403, '只能确认自己的订单');
        }
      }
      
      db.updateBooking(booking.id, {
        paymentStatus: 'paid',
        paymentMethod: 'wechat',
        paidAt: new Date().toISOString(),
        transactionId: result.transactionId,
        escrowStatus: 'frozen'
      });
    }
    
    ok(res, result);
  } catch (error) {
    console.error('[Mock Pay Error]', error);
    fail(res, 500, error.message);
  }
});

app.get('/api/pay/orders/:outTradeNo', requireAuth, (req, res) => {
  try {
    const { outTradeNo } = req.params;
    
    // 从 outTradeNo 中提取 bookingId（格式通常为 PREFIX-bookingId-timestamp）
    const bookingId = outTradeNo.split('-')[1];
    const booking = db.getBookings().find(b => b.id === bookingId);
    
    if (booking) {
      // 验证用户只能查询自己的订单
      if (req.user.role === 'parent') {
        const parent = db.getParents().find(p => p.id === req.user.userId);
        if (!parent || (booking.parentId !== parent.id && booking.parentPhone !== parent.phone)) {
          return fail(res, 403, '只能查询自己的订单');
        }
      } else if (req.user.role === 'mentor') {
        if (booking.mentorId !== req.user.userId && booking.tutorId !== req.user.userId) {
          return fail(res, 403, '无权限');
        }
      }
    }
    
    const result = wechatPay.getOrderStatus(outTradeNo);
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
      .filter(m => m.status === 'approved')
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
  // 只有导师角色可以创建导师资料（注册时调用）
  if (req.user.role !== 'mentor' && req.user.role !== 'admin') {
    return fail(res, 403, '无权限');
  }
  
  const mentor = db.addMentor(req.body || {});
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
  // 只能修改自己的资料，或管理员可以修改任何人
  if (req.user.role !== 'admin' && req.user.userId !== req.params.id) {
    return fail(res, 403, '只能修改自己的资料');
  }
  
  const body = req.body || {};
  const options = body._options || {};
  const patch = Object.assign({}, body);
  delete patch._options;
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
  // 只有家长角色可以创建家长资料（注册时调用）
  if (req.user.role !== 'parent' && req.user.role !== 'admin') {
    return fail(res, 403, '无权限');
  }
  
  const parent = db.saveParent(req.body || {});
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
  
  // 发送预约成功短信通知
  if (booking && booking.id && booking.parentPhone) {
    try {
      await sms.sendBookingNotification(booking.parentPhone, {
        tutorName: booking.tutorName || '导师',
        subject: booking.subject || '课程',
        schedule: booking.schedule || booking.timeSlot || '',
        space: booking.space || ''
      });
    } catch (error) {
      console.error('[Booking SMS Notification Error]', error);
      // 短信发送失败不影响预约创建
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
  
  const updated = db.updateBooking(req.params.id, req.body || {});
  if (!updated) return fail(res, 404, 'booking not found');
  ok(res, updated);
});

app.post('/api/bookings/:id/respond', requireAuth, (req, res) => {
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
  ok(res, updated);
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
  if (action === 'confirm' || action === 'approve') {
    result = db.confirmSessionLeave(req.params.id, sessionId, true);
  } else if (action === 'reject') {
    result = db.confirmSessionLeave(req.params.id, sessionId, false);
  } else {
    result = db.requestSessionLeave(req.params.id, sessionId, body.byRole || 'parent');
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
  // 只有管理员可以看所有合约
  if (req.user.role !== 'admin') {
    return fail(res, 403, '需要管理员权限');
  }
  
  ok(res, db.getContracts());
});

app.post('/api/contracts', requireAuth, (req, res) => {
  // 只有管理员可以创建合约
  if (req.user.role !== 'admin') {
    return fail(res, 403, '需要管理员权限');
  }
  
  ok(res, db.saveContract(req.body || {}));
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
  console.log(`    Status:     ${sms.getProvider() === 'mock' ? '演示模式 (888888)' : '生产模式'}`);
  console.log('');
  console.log('  微信支付:');
  console.log(`    配置状态:   ${wechatPay.isConfigComplete() ? '✓ 已配置' : '✗ 未配置'}`);
  console.log(`    Mock支付:   ${wechatPay.isMockPayAllowed() ? '✓ 允许' : '✗ 禁止'}`);
  console.log('');
  if (isProduction && !process.env.ADMIN_TOKEN) {
    console.log('  ⚠️  警告: 生产环境未设置 ADMIN_TOKEN');
  }
  console.log('='.repeat(60));
});
