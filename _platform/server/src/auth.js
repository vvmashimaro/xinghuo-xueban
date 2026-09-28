/**
 * 星火学伴 · 用户认证与会话管理
 * 基于 JWT 令牌的无状态认证
 */
'use strict';

const crypto = require('crypto');

// Token 存储（生产环境应使用 Redis）
const tokenStore = new Map(); // { tokenHash: { userId, role, phone, createdAt, expiresAt } }

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * 检查手机号是否为管理员
 */
function isAdminPhone(phone) {
  const adminPhones = process.env.ADMIN_PHONES;
  if (!adminPhones) return false;
  
  const list = adminPhones.split(',').map(p => p.trim()).filter(Boolean);
  return list.includes(String(phone).trim());
}

/**
 * 生成随机令牌
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 计算令牌哈希（存储用）
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * 创建会话令牌
 * @param {string} userId - 用户 ID
 * @param {string} role - 用户角色 (parent|mentor|admin)
 * @param {string} phone - 手机号
 * @returns {string} token - 令牌
 */
function createToken(userId, role, phone) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  
  tokenStore.set(tokenHash, {
    userId,
    role,
    phone,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS
  });
  
  return token;
}

/**
 * 验证令牌并返回用户信息
 * @param {string} token - 令牌
 * @returns {object|null} { userId, role, phone } or null
 */
function verifyToken(token) {
  if (!token) return null;
  
  const tokenHash = hashToken(token);
  const session = tokenStore.get(tokenHash);
  
  if (!session) return null;
  
  // 检查过期
  if (Date.now() > session.expiresAt) {
    tokenStore.delete(tokenHash);
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
 * @returns {boolean} 是否成功撤销
 */
function revokeToken(token) {
  if (!token) return false;
  
  const tokenHash = hashToken(token);
  return tokenStore.delete(tokenHash);
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
 * Express 中间件：验证用户身份
 * 将用户信息附加到 req.user
 */
function requireAuth(req, res, next) {
  const token = extractTokenFromRequest(req);
  const user = verifyToken(token);
  
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
  const user = verifyToken(token);
  
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
  const user = verifyToken(userToken);
  
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

/**
 * 清理过期令牌（定期调用）
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [tokenHash, session] of tokenStore.entries()) {
    if (now > session.expiresAt) {
      tokenStore.delete(tokenHash);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Auth] Cleaned ${cleaned} expired tokens`);
  }
}

// 每小时清理一次过期令牌
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = {
  isAdminPhone,
  generateToken,
  createToken,
  verifyToken,
  revokeToken,
  extractTokenFromRequest,
  requireAuth,
  requireAdmin,
  requireAdminToken,
  cleanupExpiredTokens
};
