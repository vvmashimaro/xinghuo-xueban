'use strict';

/** 与 _platform/server/src/subject-catalog.js MENTOR_SUBJECT_OPTIONS 保持一致 */
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

/** 与 Web 导师入驻 L2 分组一致 */
const MENTOR_SUBJECT_GROUPS = [
  {
    key: 'primary',
    title: '小学阶段',
    hint: '基础启蒙 · 习惯培养',
    options: ['小学数学', '小学语文', '小学英语', '小学奥数思维', '小学全科陪读']
  },
  {
    key: 'junior',
    title: '初中阶段',
    hint: '中考提分 · 模块攻坚',
    options: [
      '初中数学',
      '初中物理',
      '初中化学',
      '初中英语',
      '初中语文',
      '初中全科答疑',
      '初中体育'
    ]
  },
  {
    key: 'senior',
    title: '高中阶段',
    hint: '高考拔尖 · 压轴模型',
    options: ['高中数学', '高中物理', '高中化学', '高中生物', '高中英语', '高中语文']
  },
  {
    key: 'postgrad',
    title: '考研辅导',
    hint: '统考公共课 · 院校专业课/复试',
    options: [
      '考研数学(一/二/三)',
      '考研英语(一/二)',
      '考研思想政治',
      '考研专业课一对一',
      '考研复试与调剂指导'
    ]
  },
  {
    key: 'arts',
    title: '艺体辅导',
    hint: '体考 · 舞蹈/播音 · 音乐素养',
    options: [
      '体育专项训练与中考体考',
      '舞蹈/播音艺考辅导',
      '音乐素养与视唱练耳',
      '美术/音乐艺考文化课'
    ]
  }
];

function buildSubjectChipGroups(selectedSubjects) {
  const selected = selectedSubjects || [];
  return MENTOR_SUBJECT_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    hint: group.hint,
    chips: (group.options || []).map((name) => ({
      name,
      on: selected.indexOf(name) >= 0
    }))
  }));
}

module.exports = {
  MENTOR_SUBJECT_OPTIONS,
  MENTOR_SUBJECT_GROUPS,
  buildSubjectChipGroups
};
