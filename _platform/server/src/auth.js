/**
 * 星火学伴 · 用户认证与会话管理
 * 基于 JWT 令牌的无状态认证
 */
'use strict';

const crypto = require('crypto');
const adminRbac = require('./admin-rbac');

// Verification tickets (short-lived, in-memory)
// { ticketHash: { phone, issuedAt, expiresAt } }
const verificationTickets = new Map();

const TICKET_EXPIRY_MS = 5 * 60 * 1000; // 5分钟
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

// 定期清理过期票据
setInterval(() => {
  const now = Date.now();
  for (const [hash, ticket] of verificationTickets.entries()) {
    if (now > ticket.expiresAt) {
      verificationTickets.delete(hash);
    }
  }
}, 60 * 1000); // 每分钟清理一次

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/** 环境变量 ADMIN_PHONES 覆盖默认白名单；未配置时为两个内置管理员手机号 */
function listEnvAdminPhones() {
  const DEFAULT_ADMIN_PHONES = ['13540012341', '18080141668'];
  const adminPhonesEnv = process.env.ADMIN_PHONES;
  if (adminPhonesEnv) {
    return adminPhonesEnv.split(',').map((p) => p.trim()).filter(Boolean);
  }
  return DEFAULT_ADMIN_PHONES.slice();
}

function readAdminDirectory() {
  try {
    const db = require('./db');
    if (!db || typeof db.getAdminDirectory !== 'function') return [];
    return db.getAdminDirectory() || [];
  } catch (e) {
    return [];
  }
}

function readAdminDirectoryEntry(phone) {
  try {
    const db = require('./db');
    if (!db || typeof db.getAdminDirectoryEntry !== 'function') return null;
    return db.getAdminDirectoryEntry(phone);
  } catch (e) {
    return null;
  }
}

/**
 * 检查手机号是否为管理员。
 * 主管理员始终有效；库内撤销记录可拿掉环境变量白名单中的其他管理员；
 * 主管理员添加的账号记在 adminDirectory，无需改 ADMIN_PHONES。
 */
function isAdminPhone(phone) {
  const p = String(phone || '').trim();
  if (!p) return false;
  if (adminRbac.isPrimaryAdminPhone(p)) return true;
  const entry = readAdminDirectoryEntry(p);
  if (entry && entry.revoked) return false;
  if (entry && entry.phone) return true;
  return listEnvAdminPhones().includes(p);
}

/**
 * 生成随机令牌/票据
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 计算令牌/票据哈希（存储用）
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * 创建验证票据（SMS 验证成功后签发）
 * @param {string} phone - 手机号
 * @param {boolean} mock - 是否为 mock 票据（888888 验证码）
 * @returns {string} ticket - 票据（5分钟有效）
 */
function createVerificationTicket(phone, mock = false) {
  const ticket = generateToken();
  const ticketHash = hashToken(ticket);
  const now = Date.now();
  
  verificationTickets.set(ticketHash, {
    phone,
    mock: !!mock,
    issuedAt: now,
    expiresAt: now + TICKET_EXPIRY_MS
  });
  
  return ticket;
}

/**
 * 验证并消费票据（一次性使用）
 * @param {string} ticket - 票据
 * @returns {object|null} { phone, mock } or null
 */
function verifyAndConsumeTicket(ticket) {
  if (!ticket) return null;
  
  const ticketHash = hashToken(ticket);
  const ticketData = verificationTickets.get(ticketHash);
  
  if (!ticketData) return null;
  
  // 检查过期
  if (Date.now() > ticketData.expiresAt) {
    verificationTickets.delete(ticketHash);
    return null;
  }
  
  // 消费票据（一次性）
  verificationTickets.delete(ticketHash);
  
  return {
    phone: ticketData.phone,
    mock: ticketData.mock || false
  };
}

/**
 * 创建会话令牌（持久化到数据库）
 * @param {string} userId - 用户 ID
 * @param {string} role - 用户角色 (parent|mentor|admin)
 * @param {string} phone - 手机号
 * @param {object} db - 数据库模块
 * @returns {string} token - 令牌
 */
function createToken(userId, role, phone, db) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  
  const session = {
    tokenHash,
    userId,
    role,
    phone,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS
  };
  
  db.saveAuthToken(session);
  
  return token;
}

/**
 * 验证令牌并返回用户信息
 * @param {string} token - 令牌
 * @param {object} db - 数据库模块
 * @returns {object|null} { userId, role, phone } or null
 */
function verifyToken(token, db) {
  if (!token) return null;
  
  const tokenHash = hashToken(token);
  const session = db.getAuthToken(tokenHash);
  
  if (!session) return null;
  
  // 检查过期
  if (Date.now() > session.expiresAt) {
    db.deleteAuthToken(tokenHash);
    return null;
  }
  
  return {
    userId: session.userId,
    role: session.role,
    phone: session.phone
  };
}

/**
 * 撤销令牌（登出）
 * @param {string} token - 令牌
 * @param {object} db - 数据库模块
 * @returns {boolean} 是否成功撤销
 */
function revokeToken(token, db) {
  if (!token) return false;
  
  const tokenHash = hashToken(token);
  return db.deleteAuthToken(tokenHash);
}

/**
 * 从请求头中提取令牌
 * @param {object} req - Express request
 * @returns {string|null} token
 */
function extractTokenFromRequest(req) {
  if (!req || !req.headers) return null;
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return null;

  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();

  return String(authHeader).trim();
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    const dummy = bufA.length ? bufA : Buffer.from('x');
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * 创建 Express 中间件工厂（需要传入 db）
 */
function listConfiguredAdminPhones() {
  const set = new Set(listEnvAdminPhones());
  set.add(adminRbac.SUPER_ADMIN_PHONE);
  readAdminDirectory().forEach((row) => {
    if (!row || !row.phone) return;
    const phone = String(row.phone).trim();
    if (!phone) return;
    if (row.revoked && !adminRbac.isPrimaryAdminPhone(phone)) set.delete(phone);
    else set.add(phone);
  });
  set.add(adminRbac.SUPER_ADMIN_PHONE);
  return Array.from(set);
}

function createAuthMiddleware(db) {
  /**
   * Express 中间件：验证用户身份
   * 将用户信息附加到 req.user
   */
  function requireAuth(req, res, next) {
    const token = extractTokenFromRequest(req);
    const user = verifyToken(token, db);
    
    if (!user) {
      return res.status(401).json({ error: '未登录或会话已过期' });
    }

    attachAdminUser(req, user, token);
    next();
  }

  function attachAdminUser(req, user, token) {
    req.user = user;
    req.token = token;
    if (user && user.role === 'admin') {
      req.adminModules = adminRbac.getEffectiveModules(db, user.phone);
      req.isSuperAdmin = adminRbac.isSuperAdminPhone(user.phone);
    }
  }

  function requireAdmin(req, res, next) {
    const token = extractTokenFromRequest(req);
    const user = verifyToken(token, db);
    
    if (!user) {
      return res.status(401).json({ error: '未登录或会话已过期' });
    }
    
    if (user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    
    attachAdminUser(req, user, token);
    next();
  }

  /**
   * 要求管理员且具备指定模块权限（最高管理手机号始终放行）
   */
  function requireAdminModule(moduleKey) {
    return (req, res, next) => {
      const token = extractTokenFromRequest(req);
      const user = verifyToken(token, db);

      if (!user) {
        return res.status(401).json({ error: '未登录或会话已过期' });
      }

      if (user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
      }

      attachAdminUser(req, user, token);

      if (!adminRbac.hasModule(db, user.phone, moduleKey)) {
        return res.status(403).json({ error: adminRbac.forbiddenModuleMessage(moduleKey) });
      }

      next();
    };
  }

  /** 仅主管理员（引导手机号）可添加或移除管理员 */
  function requirePrimaryAdmin(req, res, next) {
    const token = extractTokenFromRequest(req);
    const user = verifyToken(token, db);

    if (!user) {
      return res.status(401).json({ error: '未登录或会话已过期' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    attachAdminUser(req, user, token);

    if (!adminRbac.isPrimaryAdminPhone(user.phone)) {
      return res.status(403).json({ error: '仅主管理员可添加或移除管理员' });
    }

    next();
  }

  /**
   * Express 中间件：要求管理员权限（支持会话 token 和 X-Admin-Token）
   */
  function requireAdminToken(req, res, next) {
    const userToken = extractTokenFromRequest(req);
    const user = verifyToken(userToken, db);

    if (user && user.role === 'admin') {
      attachAdminUser(req, user, userToken);
      return next();
    }

    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const headerToken = String(req.headers['x-admin-token'] || '').trim() || userToken || '';
    if (!safeCompare(headerToken, adminToken)) {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    req.user = { userId: 'ADMIN-STATIC', role: 'admin', phone: '' };
    next();
  }

  return {
    requireAuth,
    requireAdmin,
    requireAdminModule,
    requirePrimaryAdmin,
    requireAdminToken,
    attachAdminUser
  };
}

/**
 * 清理过期令牌（定期调用）
 */
function cleanupExpiredTokens(db) {
  db.cleanupExpiredAuthTokens();
}

module.exports = {
  isAdminPhone,
  listConfiguredAdminPhones,
  isSuperAdminPhone: adminRbac.isSuperAdminPhone,
  generateToken,
  createVerificationTicket,
  verifyAndConsumeTicket,
  createToken,
  verifyToken,
  revokeToken,
  extractTokenFromRequest,
  safeCompare,
  createAuthMiddleware,
  cleanupExpiredTokens
};
