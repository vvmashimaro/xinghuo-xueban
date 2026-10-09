'use strict';

/** 顶层学段 / 分类（与注册、测评、导师标签一致） */
const TOP_LEVEL_GRADE_BANDS = ['小学', '初中', '高中', '考研', '艺体'];

/** 家长注册「目标学科」多选 */
const PARENT_TARGET_SUBJECTS = [
  '数学',
  '物理',
  '英语',
  '化学',
  '语文',
  '体育',
  '全科陪读答疑'
];

/** 学科测评 tab（含初中体育） */
const ASSESSMENT_SUBJECTS = ['数学', '英语', '物理', '化学', '体育'];

/** 导师入驻 / 小程序可选标准学科标签 */
const MENTOR_SUBJECT_OPTIONS = [
  '小学数学',
  '小学英语',
  '小学语文',
  '小学奥数思维',
  '小学全科陪读',
  '初中数学',
  '初中物理',
  '初中英语',
  '初中化学',
  '初中语文',
  '初中体育',
  '初中全科答疑',
  '高中数学',
  '高中物理',
  '高中英语',
  '高中化学',
  '高中语文',
  '高中生物',
  '考研数学(一/二/三)',
  '考研英语(一/二)',
  '考研思想政治',
  '考研专业课一对一',
  '考研复试与调剂指导',
  '美术/音乐艺考文化课',
  '体育专项训练与中考体考',
  '舞蹈/播音艺考辅导',
  '音乐素养与视唱练耳'
];

function gradeBandFromGrade(gradeStr) {
  const g = String(gradeStr || '').trim();
  if (!g) return '初中';
  if (/考研|研究生|统考公共课/.test(g)) return '考研';
  if (/艺体|体育专项|舞蹈|音乐素养|体考|艺考/.test(g)) return '艺体';
  if (/高[一二三]|高中|艺考文化课/.test(g)) return '高中';
  if (/初[一二三]|[七八九]年级|初中|中考/.test(g)) return '初中';
  if (/小[一二三四五六]|[一二三四五六]年级|小学|小四及以下|小升初/.test(g)) return '小学';
  if (/竞赛|自招|强基/.test(g)) return '高中';
  return '初中';
}

function normalizeAssessmentSubject(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  for (const b of ASSESSMENT_SUBJECTS) {
    if (s === b || s.indexOf(b) >= 0) return b;
  }
  return s;
}

function getSubjectCatalog() {
  return {
    topLevelGradeBands: TOP_LEVEL_GRADE_BANDS.slice(),
    parentTargetSubjects: PARENT_TARGET_SUBJECTS.slice(),
    assessmentSubjects: ASSESSMENT_SUBJECTS.slice(),
    mentorSubjectOptions: MENTOR_SUBJECT_OPTIONS.slice()
  };
}

module.exports = {
  TOP_LEVEL_GRADE_BANDS,
  PARENT_TARGET_SUBJECTS,
  ASSESSMENT_SUBJECTS,
  MENTOR_SUBJECT_OPTIONS,
  gradeBandFromGrade,
  normalizeAssessmentSubject,
  getSubjectCatalog
};
