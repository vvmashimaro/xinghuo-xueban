/**
 * 星火学伴 · 用户认证与会话管理
 * 基于 JWT 令牌的无状态认证
 */
'use strict';

const crypto = require('crypto');

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

/**
 * 检查手机号是否为管理员
 * 默认管理员: 13540012341, 18080141668
 * ADMIN_PHONES 环境变量可覆盖或扩展
 */
function isAdminPhone(phone) {
  const DEFAULT_ADMIN_PHONES = ['13540012341', '18080141668'];
  const adminPhonesEnv = process.env.ADMIN_PHONES;
  
  let list = [];
  if (adminPhonesEnv) {
    // ADMIN_PHONES 可以覆盖默认列表，或使用逗号分隔添加更多
    list = adminPhonesEnv.split(',').map(p => p.trim()).filter(Boolean);
  } else {
    // 使用默认管理员列表
    list = DEFAULT_ADMIN_PHONES;
  }
  
  return list.includes(String(phone).trim());
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
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  
  // 支持 "Bearer <token>" 格式
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1];
  
  return authHeader;
}

/**
 * 创建 Express 中间件工厂（需要传入 db）
 */
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
    
    req.user = user;
    req.token = token;
    next();
  }

  /**
   * Express 中间件：要求管理员权限
   */
  function requireAdmin(req, res, next) {
    const token = extractTokenFromRequest(req);
    const user = verifyToken(token, db);
    
    if (!user) {
      return res.status(401).json({ error: '未登录或会话已过期' });
    }
    
    if (user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    
    req.user = user;
    req.token = token;
    next();
  }

  /**
   * Express 中间件：要求管理员权限（支持 token 和 X-Admin-Token）
   */
  function requireAdminToken(req, res, next) {
    // 先检查用户登录 token
    const userToken = extractTokenFromRequest(req);
    const user = verifyToken(userToken, db);
    
    if (user && user.role === 'admin') {
      req.user = user;
      req.token = userToken;
      return next();
    }
    
    // 检查静态 admin token（备用）
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      return res.status(500).json({ error: '服务器未配置管理员令牌' });
    }
    
    const providedToken = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
    if (providedToken !== adminToken) {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    
    next();
  }

  return { requireAuth, requireAdmin, requireAdminToken };
}

/**
 * 清理过期令牌（定期调用）
 */
function cleanupExpiredTokens(db) {
  db.cleanupExpiredAuthTokens();
}

module.exports = {
  isAdminPhone,
  generateToken,
  createVerificationTicket,
  verifyAndConsumeTicket,
  createToken,
  verifyToken,
  revokeToken,
  extractTokenFromRequest,
  createAuthMiddleware,
  cleanupExpiredTokens
};
