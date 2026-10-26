'use strict';

/** E+C 家长找学伴：年级 → 学科（与 subject-catalog 学段一致） */
const GRADE_SUBJECTS = {
  小学: ['语文', '数学', '英语'],
  初中: ['语文', '数学', '英语', '物理', '化学', '初中体育'],
  高中: ['语文', '数学', '英语', '物理', '化学', '生物'],
  考研: ['考研数学', '考研英语', '考研政治'],
  艺体: ['美术', '音乐', '体育', '舞蹈']
};

const BROWSE_TIME_OPTIONS = ['全部', '工作日晚', '周末上午', '周末下午', '周末晚', '全天'];

function subjectKey(s) {
  if (!s) return '';
  return String(s)
    .replace(/^艺体[·・.]?/, '')
    .replace(/^(小学|初中|高中|考研)/, '')
    .replace(/专项$/, '')
    .replace(/奥赛$/, '')
    .replace(/入门$/, '')
    .trim();
}

function inferGradeBandsFromMentor(mentor) {
  const subjects = []
    .concat(mentor.subjects || [], mentor.customSubjects || [])
    .map((s) => String(s));
  const bands = new Set();
  subjects.forEach((s) => {
    if (/小学/.test(s)) bands.add('小学');
    if (/初中|中考体考/.test(s)) bands.add('初中');
    if (/高中|艺考文化课/.test(s)) bands.add('高中');
    if (/考研/.test(s)) bands.add('考研');
    if (/美术|音乐|体育|舞蹈|艺考|体考|艺体/.test(s)) bands.add('艺体');
  });
  if (!bands.size) bands.add('初中');
  return Array.from(bands);
}

function mentorMatchesSubject(mentor, subject) {
  if (!subject) return true;
  const subjects = []
    .concat(mentor.subjects || [], mentor.customSubjects || [])
    .map((s) => String(s));
  const key = subjectKey(subject);
  return subjects.some((s) => {
    if (s === subject) return true;
    if (s.indexOf(subject) >= 0 || subject.indexOf(s) >= 0) return true;
    const mk = subjectKey(s);
    if (mk && key && (mk === key || mk.indexOf(key) >= 0 || key.indexOf(mk) >= 0)) return true;
    if (subject === '音乐' && /钢琴|音乐|艺体/.test(s)) return true;
    if (subject === '体育' && /体育/.test(s)) return true;
    if (subject === '美术' && /美术|绘画/.test(s)) return true;
    if (subject === '舞蹈' && /舞蹈/.test(s)) return true;
    if (subject === '初中体育' && /体育/.test(s)) return true;
    if (subject === '语文' && /语文|作文/.test(s)) return true;
    if (subject === '英语' && /英语/.test(s)) return true;
    if (subject === '考研英语' && /英语/.test(s)) return true;
    if (subject === '考研政治' && /政治|思想政治/.test(s)) return true;
    if (subject === '考研数学' && /数学/.test(s)) return true;
    return false;
  });
}

function mentorMatchesGrade(mentor, grade) {
  if (!grade) return true;
  const bands = inferGradeBandsFromMentor(mentor);
  if (bands.indexOf(grade) >= 0) return true;
  if (grade === '艺体') {
    const subjects = []
      .concat(mentor.subjects || [], mentor.customSubjects || [])
      .join(' ');
    return /艺体|钢琴|美术|音乐|体育|舞蹈|艺考/.test(subjects);
  }
  return false;
}

function availabilityText(mentor) {
  const slots = mentor.availableSlots || [];
  const avail = mentor.availability || [];
  const parts = [];
  slots.forEach((s) => parts.push(String(s)));
  avail.forEach((w) => {
    if (w && w.label) parts.push(String(w.label));
    if (w && Array.isArray(w.times)) w.times.forEach((t) => parts.push(String(t)));
  });
  return parts.join(' ');
}

function mentorMatchesTime(mentor, time) {
  if (!time || time === '全部') return true;
  const s = availabilityText(mentor);
  if (!s) return true;
  if (time === '工作日晚' && !/周[一二三四五]晚|工作日/.test(s)) return false;
  if (time === '周末上午' && !/周[六日]上午|周末.*上午/.test(s)) return false;
  if (time === '周末下午' && !/周[六日]下午|周末.*下午/.test(s)) return false;
  if (time === '周末晚' && !/周[六日]晚|周末.*晚/.test(s)) return false;
  if (time === '全天' && !/全天/.test(s)) return false;
  return true;
}

function filterBrowseMentors(mentors, opts) {
  const grade = opts && opts.grade;
  const subject = opts && opts.subject;
  const time = opts && opts.time;
  return (mentors || []).filter((m) => {
    if (!mentorMatchesGrade(m, grade)) return false;
    if (!mentorMatchesSubject(m, subject)) return false;
    if (!mentorMatchesTime(m, time)) return false;
    return true;
  });
}

module.exports = {
  GRADE_SUBJECTS,
  BROWSE_TIME_OPTIONS,
  filterBrowseMentors,
  mentorMatchesGrade,
  mentorMatchesSubject,
  inferGradeBandsFromMentor
};
