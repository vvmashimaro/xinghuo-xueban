/**
 * 星火学伴 · 统一存储服务（微信小程序）
 * 本地 wx.storage 作缓存；读写同步到统一库 API
 */
'use strict';

const config = require('./config.js');
const API_BASE = (config && config.API_BASE) || 'http://127.0.0.1:8787';

const KEYS = {
  mentors: 'xh_mentors_v1',
  parents: 'xh_parents_v1',
  bookings: 'xh_bookings_v1',
  session: 'xh_session_v1',
  contracts: 'xh_contracts_v1',
  seeded: 'xh_seeded_v1'
};

let _readyResolve;
const _readyPromise = new Promise((resolve) => { _readyResolve = resolve; });
let _hydrated = false;
let _serverDownToastShown = false;

function _read(key, fallback) {
  try {
    const raw = wx.getStorageSync(key);
    if (raw === '' || raw == null || raw === undefined) return fallback;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (e) { return raw; }
    }
    return raw;
  } catch (e) {
    console.warn('[StorageService] read fail', key, e);
    return fallback;
  }
}

function _write(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    console.warn('[StorageService] write fail', key, e);
    return false;
  }
}

function _now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function _uid(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}

const DEFAULT_SLOTS = [
  '周六 09:00-11:00', '周六 14:00-16:00', '周日 09:00-11:00',
  '周日 19:00-21:00', '周三 19:00-21:00'
];

const SPACE_OPTIONS = [
  '青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'
];

function _withMentorDefaults(m) {
  const copy = Object.assign({}, m);
  if (!copy.availableSlots || !copy.availableSlots.length) {
    copy.availableSlots = DEFAULT_SLOTS.slice();
  }
  if (!copy.preferredSpaces) {
    copy.preferredSpaces = copy.spacePreference
      ? [copy.spacePreference]
      : [SPACE_OPTIONS[0]];
  }
  if (copy.bankName == null) copy.bankName = '招商银行';
  if (copy.bankCardNumber == null) copy.bankCardNumber = '';
  if (copy.sensitiveChangePending == null) copy.sensitiveChangePending = false;
  return copy;
}

function getSeedBookings() {
  return [
    {
      id: 'BK-SEED-001', mentorId: 'AP-8802', tutorId: 'AP-8802', tutorName: '李老师',
      parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
      studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中物理',
      space: '高新大源中央微网点', schedule: '2026-09-20 周六 14:00-16:00',
      timeSlot: '周六 14:00-16:00', amount: 220, hours: 2, status: 'pending_accept',
      createdAt: '2026-09-14 16:20', declineReason: ''
    },
    {
      id: 'BK-SEED-002', mentorId: 'AP-8802', tutorId: 'AP-8802', tutorName: '李老师',
      parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
      studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中数学',
      space: '高新大源中央微网点', schedule: '2026-09-21 周日 09:00-11:00',
      timeSlot: '周日 09:00-11:00', amount: 220, hours: 2, status: 'pending_accept',
      createdAt: '2026-09-14 18:05', declineReason: ''
    },
    {
      id: 'BK-SEED-003', mentorId: 'AP-8803', tutorId: 'AP-8803', tutorName: '王老师',
      parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
      studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中英语',
      space: '青羊金沙文化微网点', schedule: '2026-09-22 周一 19:00-21:00',
      timeSlot: '周一 19:00-21:00', amount: 240, hours: 2, status: 'pending_accept',
      createdAt: '2026-09-14 20:40', declineReason: ''
    }
  ];
}

function getSeedMentors() {
  return [
    {
      id: 'AP-8802', code: 'CD-2026-8810', realName: '李思源', phone: '13880123456',
      university: '电子科技大学', subjects: ['初中物理', '初中数学', '初中全科答疑'],
      customSubjects: [], hourlyRate: 110, styles: ['基础漏洞重构', '错题本高效提分法'],
      status: 'approved', evalGrade: 'V1 级标准导师', spacePreference: '高新大源中央微网点',
      scoreHighlight: '高考理综278分 · 物理满分110', publicTeacherCompliance: true,
      submitTime: '2026-09-09 19:40', reviewComment: '', proofFiles: [], lectureUrl: '#'
    },
    {
      id: 'AP-8803', code: 'CD-2026-8811', realName: '王艺霖', phone: '15928114422',
      university: '西南交通大学', subjects: ['小学英语', '初中英语', '考研英语(一/二)'],
      customSubjects: [], hourlyRate: 120, styles: ['引导启发解题', '耐心督学陪读'],
      status: 'approved', evalGrade: 'V2 级金牌导师', spacePreference: '青羊金沙文化微网点',
      scoreHighlight: '高考英语146分', publicTeacherCompliance: true,
      submitTime: '2026-09-09 20:15', reviewComment: '', proofFiles: [], lectureUrl: '#'
    }
  ];
}

function getSeedParent() {
  return {
    id: 'PAR-DEMO-001', parentName: '刘女士', parentRole: '妈妈', phone: '13980889211',
    studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', cityDistrict: '青羊区',
    subjects: ['数学', '物理'],
    subjectPlans: {
      '数学': { weakPoints: ['二次函数图象性质与最值求法'], pacing: '查缺补漏 · 阶段单元复盘', pains: ['畏难情绪遇压轴就慌'] },
      '物理': { weakPoints: ['动态电路欧姆定律综合计算'], pacing: '紧贴校内进度 · 随堂查漏补缺', pains: ['概念模糊公式乱用'] }
    },
    syllabusTopics: ['二次函数图象性质与最值求法', '动态电路欧姆定律综合计算'],
    pacingMode: '查缺补漏 · 阶段单元复盘',
    budgetMin: 100, budgetMax: 160, budgetRate: 130,
    selectedSpace: '青羊金沙文化微网点',
    targetGoal: '希望在中考前加强几何综合证明与函数动点题型。',
    painTags: ['畏难情绪遇压轴就慌', '概念模糊公式乱用'],
    createdAt: '2026-09-10 09:00', updatedAt: '2026-09-10 09:00'
  };
}

function _applySnapshot(snap) {
  if (!snap || typeof snap !== 'object') return;
  if (Array.isArray(snap.mentors)) _write(KEYS.mentors, snap.mentors.map(_withMentorDefaults));
  if (Array.isArray(snap.parents)) _write(KEYS.parents, snap.parents);
  if (Array.isArray(snap.bookings)) _write(KEYS.bookings, snap.bookings);
  if (Array.isArray(snap.contracts)) _write(KEYS.contracts, snap.contracts);
  if (snap.session) _write(KEYS.session, snap.session);
  _write(KEYS.seeded, snap.seeded != null ? !!snap.seeded : true);
}

function _request(method, path, body) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE.replace(/\/$/, '') + path,
      method: method,
      data: body !== undefined ? body : undefined,
      header: { 'Content-Type': 'application/json', Accept: 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error('API ' + res.statusCode + ' ' + path));
      },
      fail(err) {
        reject(err || new Error('network fail'));
      }
    });
  });
}

async function _apiSafe(method, path, body) {
  try {
    return await _request(method, path, body);
  } catch (e) {
    console.warn('[StorageService] API fail', method, path, e);
    return null;
  }
}

function _toastOnce(msg) {
  if (_serverDownToastShown) return;
  _serverDownToastShown = true;
  try {
    wx.showToast({ title: msg, icon: 'none', duration: 3500 });
  } catch (e) {
    console.warn(msg);
  }
}

const StorageService = {
  KEYS,
  API_BASE,
  SPACE_OPTIONS,
  DEFAULT_SLOTS,

  ready() { return _readyPromise; },
  isHydrated() { return _hydrated; },

  async hydrateFromServer() {
    try {
      const snap = await _request('GET', '/api/snapshot');
      _applySnapshot(snap);
      _hydrated = true;
      return snap;
    } catch (e) {
      console.warn('[StorageService] hydrate fail, local fallback', e);
      _toastOnce('统一库暂不可用，已用本地缓存');
      StorageService.seedIfEmptyLocal();
      _hydrated = true;
      return null;
    } finally {
      if (_readyResolve) { _readyResolve(true); _readyResolve = null; }
    }
  },

  seedIfEmptyLocal() {
    const mentors = _read(KEYS.mentors, null);
    if (!mentors || !Array.isArray(mentors) || mentors.length === 0) {
      _write(KEYS.mentors, getSeedMentors().map(_withMentorDefaults));
    } else {
      let needWrite = false;
      const patched = mentors.map((m) => {
        if (!m.availableSlots || !m.availableSlots.length || !m.preferredSpaces) {
          needWrite = true;
          return _withMentorDefaults(m);
        }
        return m;
      });
      if (needWrite) _write(KEYS.mentors, patched);
    }
    const parents = _read(KEYS.parents, null);
    if (!parents || !Array.isArray(parents) || parents.length === 0) {
      _write(KEYS.parents, [getSeedParent()]);
    }
    const bookings = _read(KEYS.bookings, null);
    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
      _write(KEYS.bookings, getSeedBookings());
    }
    if (!_read(KEYS.seeded, false)) _write(KEYS.seeded, true);
    return true;
  },

  seedIfEmpty() {
    this.seedIfEmptyLocal();
    if (!_hydrated) this.hydrateFromServer();
    return true;
  },

  async resetDemoData() {
    const snap = await _apiSafe('POST', '/api/reset');
    if (snap) { _applySnapshot(snap); return true; }
    _write(KEYS.mentors, getSeedMentors().map(_withMentorDefaults));
    _write(KEYS.parents, [getSeedParent()]);
    _write(KEYS.bookings, getSeedBookings());
    _write(KEYS.contracts, []);
    return true;
  },

  getMentors() { this.seedIfEmptyLocal(); return _read(KEYS.mentors, []); },
  saveMentors(list) { return _write(KEYS.mentors, list || []); },
  getMentorById(id) { return this.getMentors().find((m) => m.id === id) || null; },
  getMentorByPhone(phone) {
    if (!phone) return null;
    const p = String(phone).trim();
    return this.getMentors().find((m) => m.phone && String(m.phone).trim() === p) || null;
  },
  getCurrentMentor() {
    this.seedIfEmptyLocal();
    const session = this.getSession();
    if (!session) return null;
    if (session.mentorId) {
      const byId = this.getMentorById(session.mentorId);
      if (byId) return byId;
    }
    if (session.phone) return this.getMentorByPhone(session.phone);
    return null;
  },

  updateMentorProfile(id, patch, options) {
    const opts = options || {};
    const list = this.getMentors();
    const idx = list.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    const next = Object.assign({}, list[idx], patch || {}, { updatedAt: _now() });
    if (opts.sensitiveChange) {
      next.status = 'pending';
      next.sensitiveChangePending = true;
      next.reviewComment = next.reviewComment || '';
      if (!String(next.reviewComment).includes('敏感信息变更')) {
        next.reviewComment = '【敏感信息变更待复审】' + (next.reviewComment || '');
      }
    }
    if (Array.isArray(next.preferredSpaces) && next.preferredSpaces.length) {
      next.spacePreference = next.preferredSpaces[0];
    }
    list[idx] = _withMentorDefaults(next);
    this.saveMentors(list);
    const body = Object.assign({}, patch || {}, { _options: opts });
    _apiSafe('PATCH', '/api/mentors/' + encodeURIComponent(id), body);
    return list[idx];
  },

  addMentor(mentor) {
    const list = this.getMentors();
    const record = Object.assign({
      id: _uid('AP'),
      code: 'CD-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
      status: 'pending', submitTime: _now(), evalGrade: '待教研评级', reviewComment: '',
      publicTeacherCompliance: true, customSubjects: [], proofFiles: [], styles: [], subjects: []
    }, mentor);
    const normalized = _withMentorDefaults(record);
    list.unshift(normalized);
    this.saveMentors(list);
    const session = this.getSession() || {};
    session.role = 'mentor';
    session.mentorId = normalized.id;
    session.phone = normalized.phone || session.phone;
    this.setSession(session);
    _apiSafe('POST', '/api/mentors', mentor || {}).then((remote) => {
      if (remote && remote.id) {
        const all = this.getMentors().filter((m) => m.id !== normalized.id);
        all.unshift(_withMentorDefaults(remote));
        this.saveMentors(all);
        const s = this.getSession() || {};
        s.mentorId = remote.id;
        s.phone = remote.phone || s.phone;
        this.setSession(s);
      }
    });
    return normalized;
  },

  updateMentor(id, patch) {
    const list = this.getMentors();
    const idx = list.findIndex((m) => m.id === id);
    if (idx < 0) return null;
    list[idx] = Object.assign({}, list[idx], patch, { updatedAt: _now() });
    this.saveMentors(list);
    _apiSafe('PATCH', '/api/mentors/' + encodeURIComponent(id), patch || {});
    return list[idx];
  },

  getPendingMentors() { return this.getMentors().filter((m) => m.status === 'pending'); },
  getApprovedMentors() { return this.getMentors().filter((m) => m.status === 'approved'); },

  getParents() { this.seedIfEmptyLocal(); return _read(KEYS.parents, []); },

  normalizeParentProfile(p) {
    if (!p || typeof p !== 'object') return p;
    const out = Object.assign({}, p);
    if (out.budgetMin == null && out.budgetMax == null && out.budgetRate != null) {
      const mid = Number(out.budgetRate) || 130;
      out.budgetMin = Math.max(70, mid - 30);
      out.budgetMax = Math.min(240, mid + 30);
    }
    if (out.budgetMin == null) out.budgetMin = 80;
    if (out.budgetMax == null) out.budgetMax = 180;
    if (out.budgetRate == null) {
      out.budgetRate = Math.round((Number(out.budgetMin) + Number(out.budgetMax)) / 2);
    }
    if (!out.subjectPlans || typeof out.subjectPlans !== 'object') {
      out.subjectPlans = {};
      if (out.subjects && out.subjects.length && (out.syllabusTopics || out.painTags || out.pacingMode)) {
        const topics = out.syllabusTopics || [];
        const pains = out.painTags || [];
        const pacing = out.pacingMode || '紧贴校内进度 · 随堂查漏补缺';
        out.subjects.forEach(function (s, i) {
          out.subjectPlans[s] = {
            weakPoints: i === 0 ? topics.slice() : [],
            pacing: pacing,
            pains: i === 0 ? pains.slice() : []
          };
        });
      }
    }
    if (!Array.isArray(out.syllabusTopics)) {
      const flat = [];
      Object.keys(out.subjectPlans).forEach(function (s) {
        (out.subjectPlans[s].weakPoints || []).forEach(function (t) {
          if (flat.indexOf(t) < 0) flat.push(t);
        });
      });
      out.syllabusTopics = flat;
    }
    if (!Array.isArray(out.painTags)) {
      const flat = [];
      Object.keys(out.subjectPlans).forEach(function (s) {
        (out.subjectPlans[s].pains || []).forEach(function (t) {
          if (flat.indexOf(t) < 0) flat.push(t);
        });
      });
      out.painTags = flat;
    }
    return out;
  },

  addParent(profile) { return this.saveParent(profile); },

  saveParent(profile) {
    const list = this.getParents();
    const incoming = this.normalizeParentProfile(profile || {}) || {};
    let idx = -1;
    if (incoming.id) idx = list.findIndex((p) => p.id === incoming.id);
    if (idx < 0 && incoming.phone) {
      const phone = String(incoming.phone).trim();
      idx = list.findIndex((p) => p.phone && String(p.phone).trim() === phone);
    }
    const record = Object.assign({
      id: (idx >= 0 && list[idx].id) || incoming.id || _uid('PAR'),
      createdAt: (idx >= 0 && list[idx].createdAt) || _now()
    }, incoming, { updatedAt: _now() });
    if (idx >= 0) {
      record.id = list[idx].id;
      record.createdAt = list[idx].createdAt || record.createdAt;
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    _write(KEYS.parents, list);
    const session = this.getSession() || {};
    session.role = 'parent';
    session.parentId = record.id;
    session.phone = record.phone;
    this.setSession(session);
    _apiSafe('POST', '/api/parents', record);
    return record;
  },

  getCurrentParent() {
    this.seedIfEmptyLocal();
    const session = this.getSession();
    const list = this.getParents();
    let found = null;
    if (session && session.parentId) found = list.find((p) => p.id === session.parentId) || null;
    if (!found && session && session.phone) found = list.find((p) => p.phone === session.phone) || null;
    if (!found) found = list[0] || null;
    return found ? this.normalizeParentProfile(found) : null;
  },

  getBookings() { this.seedIfEmptyLocal(); return _read(KEYS.bookings, []); },
  saveBookings(list) { return _write(KEYS.bookings, list || []); },
  getBookingById(id) { return this.getBookings().find((b) => b.id === id) || null; },

  addBooking(booking) {
    const list = this.getBookings();
    const mentorId = (booking && (booking.mentorId || booking.tutorId)) || '';
    const record = Object.assign({
      id: _uid('BK'), createdAt: _now(), status: 'pending_accept', declineReason: '',
      mentorId: mentorId, tutorId: mentorId
    }, booking, {
      mentorId: mentorId || (booking && booking.mentorId) || '',
      tutorId: mentorId || (booking && (booking.tutorId || booking.mentorId)) || ''
    });
    list.unshift(record);
    this.saveBookings(list);
    _apiSafe('POST', '/api/bookings', booking || record).then((remote) => {
      if (remote && remote.id) {
        const all = this.getBookings().filter((b) => b.id !== record.id);
        all.unshift(remote);
        this.saveBookings(all);
      }
    });
    return record;
  },

  getBookingsForMentor(mentorId) {
    if (!mentorId) return [];
    return this.getBookings().filter((b) => b.mentorId === mentorId || b.tutorId === mentorId);
  },

  getBookingsForParent(parentId) {
    if (!parentId) return [];
    return this.getBookings().filter((b) => b.parentId === parentId);
  },

  respondToBooking(id, decision) {
    const list = this.getBookings();
    const idx = list.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    const d = decision || {};
    const accept = d.accept === true || d.action === 'accept';
    const decline = d.accept === false || d.decline === true || d.action === 'decline';
    if (accept) {
      list[idx] = Object.assign({}, list[idx], { status: 'accepted', declineReason: '', respondedAt: _now() });
    } else if (decline) {
      list[idx] = Object.assign({}, list[idx], {
        status: 'declined',
        declineReason: d.reason || d.declineReason || '导师暂时无法承接此时段',
        respondedAt: _now()
      });
    } else {
      return list[idx];
    }
    this.saveBookings(list);
    _apiSafe('POST', '/api/bookings/' + encodeURIComponent(id) + '/respond', d);
    return list[idx];
  },

  updateBooking(id, patch) {
    const list = this.getBookings();
    const idx = list.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    list[idx] = Object.assign({}, list[idx], patch || {}, { updatedAt: _now() });
    this.saveBookings(list);
    _apiSafe('PATCH', '/api/bookings/' + encodeURIComponent(id), patch || {});
    return list[idx];
  },

  getContracts() { return _read(KEYS.contracts, []); },

  saveContract(contract) {
    const list = this.getContracts();
    const record = Object.assign({ id: _uid('CT'), signedAt: _now() }, contract);
    list.unshift(record);
    _write(KEYS.contracts, list);
    _apiSafe('POST', '/api/contracts', contract || record);
    return record;
  },

  setSession(session) {
    _write(KEYS.session, session || {});
    _apiSafe('PUT', '/api/session', session || {});
    return true;
  },
  getSession() { return _read(KEYS.session, null); },
  clearSession() {
    try { wx.removeStorageSync(KEYS.session); } catch (e) {}
    _apiSafe('PUT', '/api/session', {});
  },

  _subjectOverlap(mentorSubjects, parentSubjects) {
    if (!parentSubjects || parentSubjects.length === 0) return 0.5;
    const ms = (mentorSubjects || []).map((s) => String(s).toLowerCase());
    let hits = 0;
    parentSubjects.forEach((ps) => {
      const p = String(ps).toLowerCase();
      if (ms.some((m) => m.includes(p) || p.includes(m.replace(/初中|高中|小学|考研/g, '')))) hits += 1;
    });
    return hits / parentSubjects.length;
  },

  mentorToTutorCard(mentor, parentProfile) {
    const surname = (mentor.realName || '导').charAt(0);
    const subjects = [].concat(mentor.subjects || [], mentor.customSubjects || []);
    const parentNorm = this.normalizeParentProfile(parentProfile || {}) || {};
    const parentSubjects = parentNorm.subjects || [];
    let parentTopics = parentNorm.syllabusTopics || [];
    if ((!parentTopics || !parentTopics.length) && parentNorm.subjectPlans) {
      parentTopics = [];
      Object.keys(parentNorm.subjectPlans).forEach(function (s) {
        (parentNorm.subjectPlans[s].weakPoints || []).forEach(function (t) {
          if (parentTopics.indexOf(t) < 0) parentTopics.push(t);
        });
      });
    }
    const budgetMin = Number(parentNorm.budgetMin) || 80;
    const budgetMax = Number(parentNorm.budgetMax) || 180;
    const budget = Number(parentNorm.budgetRate) || Math.round((budgetMin + budgetMax) / 2);
    const preferredSpace = parentNorm.selectedSpace || mentor.spacePreference || '青羊金沙文化微网点';
    const rate = Number(mentor.hourlyRate) || 120;
    const overlap = this._subjectOverlap(subjects, parentSubjects);
    let rateFit = 0.4;
    if (rate >= budgetMin && rate <= budgetMax) rateFit = 1;
    else if (rate < budgetMin && rate >= budgetMin * 0.85) rateFit = 0.75;
    else if (rate > budgetMax && rate <= budgetMax * 1.15) rateFit = 0.7;
    else if (rate <= budget * 1.4) rateFit = 0.55;
    const spaceFit = mentor.spacePreference === preferredSpace ? 1 : 0.85;
    const base = 88 + overlap * 8 + rateFit * 2 + spaceFit * 1.5;
    const matchScore = Math.min(99.5, Math.round(base * 10) / 10);
    const syllabusTopics =
      parentTopics.length > 0
        ? parentTopics.slice(0, 3)
        : (mentor.styles || []).slice(0, 3).concat(['考纲高频模型拆解']).slice(0, 3);
    const shortUni = (mentor.university || '').split(/[·/]/)[0].trim();
    const degreeShort = shortUni
      ? shortUni.replace('大学', '').slice(0, 6) + '·' + (subjects[0] || '辅导').replace(/初中|高中|小学/g, '').slice(0, 4)
      : '合规导师';
    return {
      id: 'TUTOR-' + (mentor.code || mentor.id || surname),
      mentorId: mentor.id, realName: mentor.realName, maskedName: surname + '老师',
      avatarLetter: surname, university: mentor.university, degree: mentor.degree || '',
      degreeShort, subjects, hourlyRate: Number(mentor.hourlyRate) || 120,
      rating: mentor.status === 'approved' ? 4.9 : 4.7,
      reviewCount: 20 + Math.floor((mentor.hourlyRate || 100) / 5),
      totalHours: 60 + Math.floor((mentor.hourlyRate || 100) / 2),
      space: mentor.spacePreference || preferredSpace, matchScore,
      scoreHighlight: mentor.scoreHighlight || '合规实名 · 学信网核验通过',
      styles: mentor.styles && mentor.styles.length ? mentor.styles : ['引导启发解题'],
      syllabusTopics, videoTitle: (subjects[0] || '学科') + ' · 试讲示范课',
      lectureUrl: mentor.lectureUrl || '#', isTopMatch: matchScore >= 95,
      tagBadge: matchScore >= 96 ? matchScore + '% AI高契合' : mentor.evalGrade || '金牌导师',
      evalGrade: mentor.evalGrade || 'V2 级金牌导师'
    };
  },

  getTutorListForParent(parentProfile) {
    const parent = parentProfile || this.getCurrentParent();
    const approved = this.getApprovedMentors();
    let tutors = approved.map((m) => this.mentorToTutorCard(m, parent));
    tutors.sort((a, b) => b.matchScore - a.matchScore);
    if (tutors.length === 0) {
      this.seedIfEmptyLocal();
      tutors = this.getApprovedMentors().map((m) => this.mentorToTutorCard(m, parent));
      tutors.sort((a, b) => b.matchScore - a.matchScore);
    }
    return tutors;
  }
};

try { StorageService.seedIfEmptyLocal(); } catch (e) {
  console.warn('[StorageService] local seed fail', e);
}

module.exports = StorageService;
