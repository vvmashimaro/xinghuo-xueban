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
const wechatPay = require('./wechat-pay');
const wechatPhone = require('./wechat-phone');
const phoneCrypto = require('./phone-crypto');

const PORT = Number(process.env.PORT) || 8787;
const HOST = '0.0.0.0';
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

// Admin token 验证中间件（用于保护危险操作）
function requireAdminToken(req, res, next) {
  if (!isProduction) {
    // 开发环境跳过验证
    return next();
  }
  
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return fail(res, 500, '服务器未配置管理员令牌');
  }
  
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== adminToken) {
    return fail(res, 403, '需要管理员权限');
  }
  
  next();
}

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

app.get('/api/snapshot', (req, res) => {
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
    
    const result = await sms.sendSMS(phone, scene || 'login');
    
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
    
    const result = sms.verifySMS(phone, code, scene || 'login');
    
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
      mock: result.mock || false
    });
  } catch (error) {
    console.error('[SMS Verify Error]', error);
    fail(res, 500, '验证失败');
  }
});

/* ========== 微信手机号授权 ========== */
app.post('/api/wx/phone', async (req, res) => {
  try {
    const { code, userId } = req.body || {};
    
    if (!code) {
      return fail(res, 400, '缺少 code 参数');
    }
    
    // 调用微信接口获取手机号
    const phoneInfo = await wechatPhone.getUserPhone(code);
    
    ok(res, {
      success: true,
      phone: phoneInfo.purePhoneNumber,
      countryCode: phoneInfo.countryCode,
      masked: phoneCrypto.maskPhone(phoneInfo.purePhoneNumber)
    });
  } catch (error) {
    console.error('[WeChat Phone Error]', error);
    
    // 记录拒绝授权的审计日志（如果有 userId）
    if (req.body.userId) {
      db.logPhoneAudit({
        userId: req.body.userId,
        action: 'authorize_deny',
        source: 'wechat_auth',
        phoneHash: '',
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
        ua: req.headers['user-agent'] || '',
        success: false,
        error: error.message
      });
    }
    
    fail(res, 400, error.message || '获取手机号失败');
  }
});

/* ========== 手机号绑定管理 ========== */
app.post('/api/auth/phone/bind', async (req, res) => {
  try {
    const { userId, phone, source } = req.body || {};
    
    if (!userId || !phone) {
      return fail(res, 400, '缺少 userId 或 phone');
    }
    
    if (!phoneCrypto.isValidPhone(phone)) {
      return fail(res, 400, '手机号格式不正确');
    }
    
    const phoneCipher = phoneCrypto.encryptPhone(phone);
    const phoneHash = phoneCrypto.hashPhone(phone);
    
    const result = db.bindPhone(userId, phoneCipher, phoneHash, source || 'sms_verify', {
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

app.post('/api/auth/phone/unbind', (req, res) => {
  try {
    const { userId } = req.body || {};
    
    if (!userId) {
      return fail(res, 400, '缺少 userId');
    }
    
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

app.post('/api/auth/phone/cancel', (req, res) => {
  try {
    const { userId } = req.body || {};
    
    if (!userId) {
      return fail(res, 400, '缺少 userId');
    }
    
    const result = db.cancelPhone(userId, {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
      ua: req.headers['user-agent'] || ''
    });
    
    if (!result.ok) {
      return fail(res, 400, result.error);
    }
    
    ok(res, { success: true });
  } catch (error) {
    console.error('[Phone Cancel Error]', error);
    fail(res, 500, '注销失败');
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    
    if (!userId) {
      return fail(res, 400, '缺少 userId');
    }
    
    const user = db.getUserById(userId);
    
    if (!user) {
      return fail(res, 404, '用户不存在');
    }
    
    // 解密手机号并脱敏返回
    let maskedPhone = '';
    if (user.phoneCipher) {
      try {
        const phone = phoneCrypto.decryptPhone(user.phoneCipher);
        maskedPhone = phoneCrypto.maskPhone(phone);
      } catch (error) {
        console.error('[Phone Decrypt Error]', error);
      }
    }
    
    ok(res, {
      userId: user.id,
      phone: maskedPhone,
      phoneBoundAt: user.phoneBoundAt || '',
      phoneSource: user.phoneSource || ''
    });
  } catch (error) {
    console.error('[Get User Error]', error);
    fail(res, 500, '查询失败');
  }
});

app.post('/api/auth/phone/audit', (req, res) => {
  try {
    const entry = req.body || {};
    entry.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    entry.ua = req.headers['user-agent'] || '';
    
    db.logPhoneAudit(entry);
    ok(res, { success: true });
  } catch (error) {
    console.error('[Audit Log Error]', error);
    fail(res, 500, '记录失败');
  }
});

/* ========== 微信支付 ========== */
app.post('/api/pay/wechat/prepay', async (req, res) => {
  try {
    const { bookingId, amount, description, openid, payType } = req.body || {};
    
    if (!bookingId) {
      return fail(res, 400, '缺少 bookingId');
    }
    
    if (!amount || amount <= 0) {
      return fail(res, 400, '金额无效');
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
app.post('/api/pay/wechat/mock-confirm', (req, res) => {
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
    
    // 更新 booking 状态
    const booking = db.getBookings().find(b => b.id === result.bookingId);
    if (booking) {
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

app.get('/api/pay/orders/:outTradeNo', (req, res) => {
  try {
    const { outTradeNo } = req.params;
    const result = wechatPay.getOrderStatus(outTradeNo);
    ok(res, result);
  } catch (error) {
    console.error('[Get Order Error]', error);
    fail(res, 500, '查询订单失败');
  }
});

/* Mentors */
app.get('/api/mentors', (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getMentors());
});

app.post('/api/mentors', (req, res) => {
  const mentor = db.addMentor(req.body || {});
  ok(res, mentor);
});

app.get('/api/mentors/phone/:phone', (req, res) => {
  const m = db.getMentorByPhone(req.params.phone);
  if (!m) return fail(res, 404, 'mentor not found');
  ok(res, m);
});

app.get('/api/mentors/:id', (req, res) => {
  const m = db.getMentorById(req.params.id);
  if (!m) return fail(res, 404, 'mentor not found');
  ok(res, m);
});

app.patch('/api/mentors/:id', (req, res) => {
  const body = req.body || {};
  const options = body._options || {};
  const patch = Object.assign({}, body);
  delete patch._options;
  const updated = db.updateMentor(req.params.id, patch, options);
  if (!updated) return fail(res, 404, 'mentor not found');
  ok(res, updated);
});

/* Parents */
app.get('/api/parents', (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getParents());
});

app.post('/api/parents', (req, res) => {
  const parent = db.saveParent(req.body || {});
  ok(res, parent);
});

app.get('/api/parents/phone/:phone', (req, res) => {
  const p = db.getParentByPhone(req.params.phone);
  if (!p) return fail(res, 404, 'parent not found');
  ok(res, p);
});

/* Bookings */
app.get('/api/bookings', (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getBookings());
});

app.post('/api/bookings', async (req, res) => {
  const booking = db.addBooking(req.body || {});
  
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

app.patch('/api/bookings/:id', (req, res) => {
  const updated = db.updateBooking(req.params.id, req.body || {});
  if (!updated) return fail(res, 404, 'booking not found');
  ok(res, updated);
});

app.post('/api/bookings/:id/respond', (req, res) => {
  const updated = db.respondToBooking(req.params.id, req.body || {});
  if (!updated) return fail(res, 404, 'booking not found');
  ok(res, updated);
});


app.post('/api/bookings/:id/leave', (req, res) => {
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

app.post('/api/bookings/:id/complete', (req, res) => {
  const body = req.body || {};
  const result = db.completeSession(req.params.id, body.sessionId, {
    completedBy: body.completedBy || 'mentor',
    classSummary: body.classSummary || null,
    mentorId: body.mentorId
  });
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'complete failed' });
  }
  ok(res, result);
});

app.post('/api/bookings/:id/summary', (req, res) => {
  const body = req.body || {};
  const result = db.saveClassSummary(req.params.id, body.sessionId, body.classSummary || body, body.mentorId);
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'summary failed' });
  }
  ok(res, result);
});

app.post('/api/mentors/:id/availability', (req, res) => {
  const updated = db.setMentorAvailability(req.params.id, (req.body && req.body.availability) || req.body || []);
  if (!updated) return fail(res, 404, 'mentor not found');
  ok(res, updated);
});

app.post('/api/bookings/process-escrow', (req, res) => {
  ok(res, db.processEscrowReleases());
});


/* Assessments */
app.get('/api/assessments', (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getAssessments());
});

app.post('/api/assessments', (req, res) => {
  const record = db.saveAssessment(req.body || {});
  if (!record) return fail(res, 400, 'invalid assessment');
  ok(res, record);
});

/* Contracts */
app.get('/api/contracts', (req, res) => {
  ok(res, db.getContracts());
});

app.post('/api/contracts', (req, res) => {
  ok(res, db.saveContract(req.body || {}));
});

/* Session */
app.get('/api/session', (req, res) => {
  ok(res, db.getSession());
});

app.put('/api/session', (req, res) => {
  ok(res, db.setSession(req.body || {}));
});

/* Tutor match */
app.post('/api/tutors/match', (req, res) => {
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
