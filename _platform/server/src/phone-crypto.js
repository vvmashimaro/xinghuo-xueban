/**
 * 星火学伴 · 手机号加密与脱敏工具
 * 合规要求：
 * - AES-256-GCM 加密存储
 * - HMAC-SHA256 哈希用于唯一性查询
 * - 前端仅展示脱敏格式 (138****8000)
 */
'use strict';

const crypto = require('crypto');

// 从环境变量读取密钥（生产环境必须设置）
const PHONE_ENCRYPTION_KEY = process.env.PHONE_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 加密手机号
 * @param {string} phone - 原始手机号
 * @returns {string} - 加密后的 base64 字符串 (iv:encrypted:authTag)
 */
function encryptPhone(phone) {
  if (!phone) return '';
  
  if (!PHONE_ENCRYPTION_KEY) {
    console.warn('[Phone Crypto] PHONE_ENCRYPTION_KEY not set, storing in plaintext (INSECURE)');
    return `PLAIN:${phone}`;
  }
  
  if (PHONE_ENCRYPTION_KEY.length < 32) {
    throw new Error('PHONE_ENCRYPTION_KEY must be at least 32 characters');
  }
  
  const key = crypto.scryptSync(PHONE_ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(phone, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  // 格式: iv:encrypted:authTag (all base64)
  return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
}

/**
 * 解密手机号
 * @param {string} ciphertext - 加密后的字符串
 * @returns {string} - 原始手机号
 */
function decryptPhone(ciphertext) {
  if (!ciphertext) return '';
  
  // 处理未加密的历史数据
  if (ciphertext.startsWith('PLAIN:')) {
    return ciphertext.slice(6);
  }
  
  if (!PHONE_ENCRYPTION_KEY) {
    throw new Error('PHONE_ENCRYPTION_KEY not set, cannot decrypt');
  }
  
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }
  
  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], 'base64');
  
  const key = crypto.scryptSync(PHONE_ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 生成手机号哈希（用于唯一性查询）
 * @param {string} phone - 原始手机号
 * @returns {string} - HMAC-SHA256 哈希 (hex)
 */
function hashPhone(phone) {
  if (!phone) return '';
  
  const secret = PHONE_ENCRYPTION_KEY || 'default-secret-insecure';
  return crypto.createHmac('sha256', secret)
    .update(phone)
    .digest('hex');
}

/**
 * 脱敏手机号（前端展示用）
 * @param {string} phone - 原始手机号
 * @returns {string} - 脱敏格式 (138****8000)
 */
function maskPhone(phone) {
  if (!phone) return '';
  const str = String(phone);
  if (str.length !== 11) return str;
  return str.slice(0, 3) + '****' + str.slice(7);
}

/**
 * 验证是否为有效手机号
 * @param {string} phone - 待验证的手机号
 * @returns {boolean}
 */
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

module.exports = {
  encryptPhone,
  decryptPhone,
  hashPhone,
  maskPhone,
  isValidPhone
};
