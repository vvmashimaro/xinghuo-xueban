/**
 * 星火运营中台 · 管理员模块权限（RBAC）
 */
'use strict';

const SUPER_ADMIN_PHONE = '13540012341';

/** 与 admin-saas 侧栏 data-nav 一致 */
const ADMIN_MODULES = [
  { key: 'dashboard', label: '总览', group: '核心审核与风控' },
  { key: 'audit', label: '导师审核', group: '核心审核与风控' },
  { key: 'payments', label: '支付与退款', group: '核心审核与风控' },
  { key: 'feedback', label: '反馈投诉', group: '核心审核与风控' },
  { key: 'bookings', label: '预约订单', group: '用户与履约' },
  { key: 'parents', label: '家长用户', group: '用户与履约' },
  { key: 'mentors', label: '导师用户', group: '用户与履约' },
  { key: 'contracts', label: '合约', group: '用户与履约' },
  { key: 'assessments', label: '学情测评', group: '用户与履约' },
  { key: 'teaching-points', label: '教学点仓位', group: '空间与底座' },
  { key: 'system', label: '系统开关', group: '空间与底座' },
  { key: 'permissions', label: '权限设置', group: '空间与底座' }
];

const ALL_MODULE_KEYS = ADMIN_MODULES.map((m) => m.key);

const ADMIN_LIST_RESOURCE_MODULES = {
  mentors: ['dashboard', 'audit', 'mentors'],
  parents: ['parents'],
  bookings: ['dashboard', 'bookings'],
  contracts: ['contracts'],
  assessments: ['assessments'],
  feedback: ['dashboard', 'feedback']
};

function isSuperAdminPhone(phone) {
  return String(phone || '').trim() === SUPER_ADMIN_PHONE;
}

function getModuleLabel(key) {
  const found = ADMIN_MODULES.find((m) => m.key === key);
  return found ? found.label : key;
}

function getCatalog() {
  return ADMIN_MODULES.map((m) => ({ key: m.key, label: m.label, group: m.group }));
}

function normalizeModuleList(modules) {
  if (!Array.isArray(modules)) return [];
  const set = new Set();
  modules.forEach((k) => {
    const key = String(k || '').trim();
    if (ALL_MODULE_KEYS.includes(key)) set.add(key);
  });
  return Array.from(set);
}

function getEffectiveModules(db, phone) {
  if (!phone) return [];
  if (isSuperAdminPhone(phone)) return ALL_MODULE_KEYS.slice();
  const stored = db.getAdminStaffPermissions(phone);
  return normalizeModuleList(stored && stored.modules);
}

function hasModule(db, phone, moduleKey) {
  if (!moduleKey) return false;
  const effective = getEffectiveModules(db, phone);
  return effective.includes(moduleKey);
}

function hasAnyModule(db, phone, moduleKeys) {
  if (!Array.isArray(moduleKeys) || !moduleKeys.length) return false;
  const effective = getEffectiveModules(db, phone);
  return moduleKeys.some((k) => effective.includes(k));
}

function canReadAdminResource(db, phone, resource) {
  const keys = ADMIN_LIST_RESOURCE_MODULES[resource];
  if (!keys) return false;
  return hasAnyModule(db, phone, keys);
}

function mentorPatchRequiredModule(patch) {
  const body = patch || {};
  const auditKeys = ['status', 'evalGrade', 'reviewComment', 'code', 'sensitiveChangePending'];
  const hasAuditField = auditKeys.some((k) => body[k] !== undefined);
  if (hasAuditField) return 'audit';
  return 'mentors';
}

function forbiddenModuleMessage(moduleKey) {
  return '无权访问该模块：' + getModuleLabel(moduleKey);
}

module.exports = {
  SUPER_ADMIN_PHONE,
  ADMIN_MODULES,
  ALL_MODULE_KEYS,
  isSuperAdminPhone,
  getCatalog,
  normalizeModuleList,
  getEffectiveModules,
  hasModule,
  hasAnyModule,
  canReadAdminResource,
  mentorPatchRequiredModule,
  forbiddenModuleMessage,
  getModuleLabel
};
