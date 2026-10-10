'use strict';

/**
 * 开发/演示环境统一短信验证码（非生产 NODE_ENV 下由 sms.js 识别）
 * 生产环境禁用；真实 ADMIN_PHONES 白名单手机号不可使用此码登录。
 */
const DEMO_SMS_CODE = '888888';

/** 仅开发环境视为管理员的演示手机号 */
const DEMO_ADMIN_PHONES_DEV = ['13900001111'];

/** 演示家长 / 导师手机号（非生产环境可用统一验证码 DEMO_SMS_CODE） */
const DEMO_PARENT_PHONES = ['13980889211', '13980889222'];
const DEMO_MENTOR_PHONES = ['13880123456', '13880123458'];

const DEMO_PARENT_PROFILES = [
  {
    id: 'PAR-DEMO-002',
    parentName: '王先生',
    parentRole: '爸爸',
    phone: '13980889222',
    studentNickname: '小宇',
    studentGrade: '高二',
    cityDistrict: '高新区',
    subjects: ['数学', '英语'],
    subjectPlans: {
      数学: { weakPoints: ['函数与导数'], pacing: '培优拔高', pains: [] },
      英语: { weakPoints: ['阅读理解'], pacing: '查缺补漏', pains: [] }
    },
    syllabusTopics: ['函数与导数', '阅读理解'],
    pacingMode: '培优拔高',
    budgetMin: 90,
    budgetMax: 150,
    budgetRate: 120,
    selectedSpace: '高新大源中央微网点',
    targetGoal: '高二数学英语同步提升',
    painTags: [],
    createdAt: '2026-10-01 10:00',
    updatedAt: '2026-10-01 10:00'
  }
];

const DEMO_MENTOR_PROFILES = [
  {
    id: 'AP-DEMO-003',
    code: 'CD-2026-DEMO3',
    realName: '陈演示',
    phone: '13880123458',
    idCard: '510105200401011234',
    university: '西南交通大学',
    province: '四川',
    degree: '本科在读 (大二)',
    chsiCode: '',
    chsiStatus: '未提供（选填）',
    publicTeacherCompliance: true,
    subjects: ['初中数学'],
    hourlyRate: 100,
    scoreHighlight: '演示导师账号',
    styles: ['引导启发解题'],
    proofFiles: [],
    lectureUrl: 'https://example.com/demo-mentor-lecture',
    status: 'pending',
    evalGrade: '待教研评级',
    bankName: '招商银行',
    bankCardNumber: '6214830188909999',
    spacePreference: '武侯川大望江微网点'
  }
];

function isDemoAdminPhone(phone) {
  if (process.env.NODE_ENV === 'production') return false;
  return DEMO_ADMIN_PHONES_DEV.includes(String(phone || '').trim());
}

function isDemoAccountPhone(phone) {
  const p = String(phone || '').trim();
  return DEMO_PARENT_PHONES.includes(p) || DEMO_MENTOR_PHONES.includes(p);
}

module.exports = {
  DEMO_SMS_CODE,
  DEMO_ADMIN_PHONES_DEV,
  DEMO_PARENT_PHONES,
  DEMO_MENTOR_PHONES,
  DEMO_PARENT_PROFILES,
  DEMO_MENTOR_PROFILES,
  isDemoAdminPhone,
  isDemoAccountPhone
};
