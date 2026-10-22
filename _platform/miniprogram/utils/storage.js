/**
 * 星火学伴 · 统一存储服务（微信小程序）· Token-based Auth
 * Bearer token 认证，scoped endpoints，wx.storage 缓存
 */
'use strict';

const config = require('./config.js');
const Avail = require('./mentor-availability.js');
const XhLoading = require('./loading');
const API_BASE = (config && config.API_BASE) || 'http://127.0.0.1:8787';

const KEYS = {
  authToken: 'xh_auth_token_v1',
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

function _readList(key) {
  const v = _read(key, []);
  return Array.isArray(v) ? v : [];
}

function _prepend(list, item) {
  const arr = Array.isArray(list) ? list : [];
  arr.unshift(item);
  return arr;
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

const PARENT_TARGET_SUBJECTS_DEFAULT = [
  '数学', '物理', '英语', '化学', '语文', '体育', '全科陪读答疑'
];

function getSeedBookings() {
  return [
    {
      id: 'BK-SEED-001', mentorId: 'AP-8802', tutorId: 'AP-8802', tutorName: '李老师',
      parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
      studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中物理',
      space: '高新大源中央微网点', schedule: '2026-09-20 周六 14:00-16:00',
      timeSlot: '周六 14:00-16:00', amount: 220, hours: 2, status: 'pending_accept',
      createdAt: '2026-09-14 16:20', declineReason: ''
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

function _availabilityToSlotLabels(availability) {
  const labels = [];
  const wdNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  (availability || []).forEach((item) => {
    const wd = parseInt(item.weekday, 10);
    const name = wdNames[wd] || ('周' + wd);
    (item.ranges || []).forEach((r) => {
      if (r && r.start && r.end) labels.push(name + ' ' + r.start + '-' + r.end);
    });
  });
  return labels;
}

function _parseSlotLabelToAvailability(slots) {
  const wdMap = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };
  const byDay = {};
  (slots || []).forEach((raw) => {
    const s = String(raw || '').trim();
    if (!s) return;
    let wd = null;
    let rest = s;
    Object.keys(wdMap).forEach((name) => {
      if (s.indexOf(name) === 0) {
        wd = wdMap[name];
        rest = s.slice(name.length).trim();
      }
    });
    if (wd == null) return;
    const m = rest.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!m) return;
    if (!byDay[wd]) byDay[wd] = [];
    byDay[wd].push({ start: m[1].padStart(5, '0'), end: m[2].padStart(5, '0') });
  });
  return Object.keys(byDay).map((k) => ({
    weekday: parseInt(k, 10),
    ranges: byDay[k]
  }));
}

function _withMentorDefaults(m) {
  const copy = Object.assign({}, m);
  if (!Array.isArray(copy.availability)) copy.availability = [];
  if ((!copy.availableSlots || !copy.availableSlots.length) && copy.availability.length) {
    copy.availableSlots = _availabilityToSlotLabels(copy.availability);
  }
  if (copy.availableSlots == null) {
    copy.availableSlots = DEFAULT_SLOTS.slice();
  }
  if ((!copy.availability || !copy.availability.length) && copy.availableSlots && copy.availableSlots.length) {
    copy.availability = _parseSlotLabelToAvailability(copy.availableSlots);
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

function _request(method, path, body, options) {
  const opts = options || {};
  const track = !opts.silent && XhLoading.shouldTrack(path);
  if (track) XhLoading.begin();
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const token = _read(KEYS.authToken, null);
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    wx.request({
      url: API_BASE.replace(/\/$/, '') + path,
      method: method,
      data: body !== undefined ? body : undefined,
      header: headers,
      success(res) {
        if (res.statusCode === 401) {
          _write(KEYS.authToken, null);
          const err = { status: 401, message: '未授权，请重新登录' };
          if (!opts.noAuthRedirect) {
            wx.reLaunch({ url: '/pages/login/login' });
          }
          reject(err);
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const body = res.data;
          const serverError =
            body && typeof body === 'object'
              ? body.error || body.message
              : typeof body === 'string' && body.trim()
                ? body.trim()
                : null;
          reject({
            status: res.statusCode,
            data: body,
            path,
            message: serverError || `请求失败（${res.statusCode}）`
          });
        }
      },
      fail(err) {
        reject(err || new Error('network fail'));
      },
      complete() {
        if (track) XhLoading.end();
      }
    });
  });
}

function _apiErrorFromReject(e) {
  if (!e) return '请求失败';
  if (typeof e === 'string') return e;
  if (e.message) return e.message;
  const body = e.data;
  if (body && typeof body === 'object' && (body.error || body.message)) {
    return body.error || body.message;
  }
  return '请求失败';
}

async function _apiSafe(method, path, body) {
  try {
    return await _request(method, path, body);
  } catch (e) {
    console.warn('[StorageService] API fail', method, path, e);
    return null;
  }
}

const StorageService = {
  KEYS,
  API_BASE,
  SPACE_OPTIONS,
  DEFAULT_SLOTS,

  ready() { return _readyPromise; },
  isHydrated() { return _hydrated; },

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
    if (!_hydrated && this.isLoggedIn()) {
      this.hydrateFromServer();
    }
    return true;
  },

  setSession(session) {
    _write(KEYS.session, session || {});
    return true;
  },

  getSession() {
    return _read(KEYS.session, null);
  },

  clearSession() {
    try { wx.removeStorageSync(KEYS.session); } catch (e) { /* ignore */ }
    return true;
  },

  getAuthToken() {
    return _read(KEYS.authToken, null);
  },

  setAuthToken(token) {
    _write(KEYS.authToken, token || null);
  },

  clearAuthToken() {
    _write(KEYS.authToken, null);
  },

  isLoggedIn() {
    return !!this.getAuthToken();
  },

  async sendSMS(phone, scene) {
    try {
      const result = await _request('POST', '/api/auth/sms/send', { phone, scene });
      return result;
    } catch (e) {
      return { success: false, error: _apiErrorFromReject(e) || '发送失败' };
    }
  },

  async verifySMS(phone, code, scene) {
    try {
      const result = await _request('POST', '/api/auth/sms/verify', { phone, code, scene });
      return result;
    } catch (e) {
      return { success: false, error: _apiErrorFromReject(e) || '验证失败' };
    }
  },

  async login(ticket, role) {
    try {
      const result = await _request('POST', '/api/auth/login', { ticket, role });
      if (result.success && result.token) {
        this.setAuthToken(result.token);
        const user = result.user || {};
        const session = this.getSession() || {};
        session.role = role || user.role || session.role;
        const uid = user.userId || user.id;
        if (uid) {
          if (session.role === 'parent') session.parentId = uid;
          if (session.role === 'mentor') session.mentorId = uid;
        }
        if (user.profile && user.profile.phone) session.phone = user.profile.phone;
        else if (user.phone && !String(user.phone).includes('*')) session.phone = user.phone;
        this.setSession(session);
        return { success: true, user: result.user };
      }
      return { success: false, error: result.error || '登录失败' };
    } catch (e) {
      return {
        success: false,
        error: _apiErrorFromReject(e) || '登录失败',
        notRegistered: e && e.status === 404
      };
    }
  },

  async register(ticket, role, profile) {
    try {
      const result = await _request('POST', '/api/auth/register', { ticket, role, profile });
      if (result.success && result.token) {
        this.setAuthToken(result.token);
        const user = result.user || {};
        if (role === 'parent' && profile) {
          this.saveParent(profile);
        }
        const session = this.getSession() || {};
        session.role = role || user.role || 'parent';
        if (user.userId) session.parentId = user.userId;
        if (profile && profile.phone) session.phone = profile.phone;
        this.setSession(session);
        return { success: true, user: result.user };
      }
      return { success: false, error: result.error || '注册失败' };
    } catch (e) {
      return { success: false, error: _apiErrorFromReject(e) || '注册失败' };
    }
  },

  async logout() {
    try {
      await _request('POST', '/api/auth/logout', {});
    } catch (e) {
      console.warn('Logout API call failed:', e);
    }
    this.clearAuthToken();
  },

  async getCurrentUser() {
    try {
      const result = await _request('GET', '/api/auth/me', null);
      return result;
    } catch (e) {
      console.warn('Get current user failed:', e);
      return null;
    }
  },

  /** 校验本地 token 是否仍有效（登录页自动进入用，401 不强制跳转登录页） */
  async validateSession() {
    if (!this.isLoggedIn()) {
      return { valid: false };
    }
    try {
      const user = await _request('GET', '/api/auth/me', null, { noAuthRedirect: true });
      if (!user || !user.role) {
        return { valid: false };
      }
      const session = this.getSession() || {};
      session.role = user.role || session.role;
      if (user.userId) {
        if (user.role === 'parent') session.parentId = user.userId;
        if (user.role === 'mentor') session.mentorId = user.userId;
      }
      if (user.profile && user.profile.phone) session.phone = user.profile.phone;
      this.setSession(session);
      return { valid: true, user };
    } catch (e) {
      if (e && e.status === 401) {
        this.clearAuthToken();
      }
      return { valid: false };
    }
  },

  /** 微信 getPhoneNumber code → 票据 → 按角色登录 */
  async loginWithWeChatPhoneCode(code, role) {
    const phoneResult = await this.getWeChatPhone(code);
    if (!phoneResult || !phoneResult.success) {
      return {
        success: false,
        error: (phoneResult && phoneResult.error) || '获取手机号失败'
      };
    }
    const ticket = phoneResult.ticket;
    if (!ticket) {
      return { success: false, error: '未获取到验证票据，请重试' };
    }
    return this.login(ticket, role);
  },

  async hydrateFromServer() {
    try {
      if (!this.isLoggedIn()) {
        this.seedIfEmptyLocal();
        _hydrated = true;
        return null;
      }

      const user = await this.getCurrentUser();
      if (!user) {
        this.seedIfEmptyLocal();
        _hydrated = true;
        return null;
      }

      const mentors = await _apiSafe('GET', '/api/mentors', null);
      const bookings = await _apiSafe('GET', '/api/bookings', null);
      let parents = null;
      if (user.role === 'parent') {
        parents = await _apiSafe('GET', '/api/parents', null);
      }

      if (Array.isArray(mentors)) _write(KEYS.mentors, mentors.map(_withMentorDefaults));
      if (Array.isArray(parents)) _write(KEYS.parents, parents);
      if (Array.isArray(bookings)) _write(KEYS.bookings, bookings);

      const session = this.getSession() || {};
      session.role = user.role || session.role;
      if (user.userId) {
        if (user.role === 'parent') session.parentId = user.userId;
        if (user.role === 'mentor') session.mentorId = user.userId;
      }
      if (user.profile && user.profile.phone) session.phone = user.profile.phone;
      this.setSession(session);

      _hydrated = true;
      return { mentors, parents, bookings, user };
    } catch (e) {
      console.warn('[StorageService] hydrate fail', e);
      this.seedIfEmptyLocal();
      _hydrated = true;
      return null;
    } finally {
      if (_readyResolve) {
        _readyResolve(true);
        _readyResolve = null;
      }
    }
  },

  getMentors() {
    this.seedIfEmptyLocal();
    return _readList(KEYS.mentors);
  },
  saveMentors(list) { return _write(KEYS.mentors, list || []); },
  getMentorById(id) { return this.getMentors().find((m) => m.id === id) || null; },
  getMentorByPhone(phone) {
    if (!phone) return null;
    const p = String(phone).trim();
    return this.getMentors().find((m) => m.phone && String(m.phone).trim() === p) || null;
  },

  async getCurrentMentor() {
    const user = await this.getCurrentUser();
    if (!user || user.role !== 'mentor') return null;
    const mentors = this.getMentors();
    return mentors.find((m) => m.phone === user.phone) || null;
  },

  addMentor(mentor) {
    const list = this.getMentors();
    const record = Object.assign(
      {
        id: _uid('AP'),
        code: 'CD-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
        status: 'pending',
        submitTime: _now(),
        evalGrade: '待教研评级',
        reviewComment: '',
        publicTeacherCompliance: true,
        customSubjects: [],
        proofFiles: [],
        styles: [],
        subjects: []
      },
      mentor
    );
    const normalized = _withMentorDefaults(record);
    this.saveMentors(_prepend(list, normalized));
    const session = this.getSession() || {};
    session.role = 'mentor';
    session.mentorId = normalized.id;
    session.phone = normalized.phone || session.phone;
    this.setSession(session);
    _apiSafe('POST', '/api/mentors', mentor || {}).then((remote) => {
      if (remote && remote.id) {
        const all = this.getMentors().filter((m) => m.id !== normalized.id);
        this.saveMentors(_prepend(all, _withMentorDefaults(remote)));
        const s = this.getSession() || {};
        s.mentorId = remote.id;
        s.phone = remote.phone || s.phone;
        this.setSession(s);
      }
    });
    return normalized;
  },

  async updateMentorProfile(id, patch, options) {
    try {
      const result = await _request('PATCH', '/api/mentors/' + encodeURIComponent(id), {
        ...patch,
        _options: options || {}
      });
      if (result) {
        const list = this.getMentors();
        const idx = list.findIndex((m) => m.id === id);
        if (idx >= 0) {
          list[idx] = _withMentorDefaults(result);
          this.saveMentors(list);
          return list[idx];
        }
      }
      return null;
    } catch (e) {
      console.warn('Update mentor profile failed:', e);
      return null;
    }
  },

  getPendingMentors() { return this.getMentors().filter((m) => m.status === 'pending'); },
  getApprovedMentors() { return this.getMentors().filter((m) => m.status === 'approved'); },

  getParents() {
    this.seedIfEmptyLocal();
    return _readList(KEYS.parents);
  },

  addParent(profile) {
    return this.saveParent(profile);
  },

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
      _prepend(list, record);
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

  async getCurrentParent() {
    this.seedIfEmptyLocal();
    const session = this.getSession();
    const parents = this.getParents();
    let found = null;
    if (session && session.parentId) {
      found = parents.find((p) => p.id === session.parentId) || null;
    }
    if (!found && session && session.phone) {
      found = parents.find((p) => p.phone === session.phone) || null;
    }
    if (!found && this.isLoggedIn()) {
      const user = await this.getCurrentUser();
      if (user && user.role === 'parent') {
        const uid = user.userId || (user.profile && user.profile.id);
        if (uid) found = parents.find((p) => p.id === uid) || null;
        if (!found && user.profile) found = this.normalizeParentProfile(user.profile);
      }
    }
    if (!found && parents.length) found = parents[0];
    return found ? this.normalizeParentProfile(found) : null;
  },

  getBookings() { return _readList(KEYS.bookings); },
  saveBookings(list) { return _write(KEYS.bookings, Array.isArray(list) ? list : []); },
  getBookingById(id) { return this.getBookings().find((b) => b.id === id) || null; },

  async addBooking(booking) {
    try {
      const result = await _request('POST', '/api/bookings', booking);
      if (result && result.id) {
        this.saveBookings(_prepend(this.getBookings(), result));
        return result;
      }
      return result && result.error ? result : null;
    } catch (e) {
      console.warn('Add booking failed:', e);
      if (e && e.data) return e.data;
      return { ok: false, error: (e && e.message) || '创建预约失败' };
    }
  },

  getBookingsForMentor(mentorId) {
    if (!mentorId) return [];
    return this.getBookings().filter((b) => b.mentorId === mentorId || b.tutorId === mentorId);
  },

  getBookingsForParent(parentId) {
    if (!parentId) return [];
    return this.getBookings().filter((b) => b.parentId === parentId);
  },

  async respondToBooking(id, decision) {
    try {
      const result = await _request('POST', '/api/bookings/' + encodeURIComponent(id) + '/respond', decision);
      if (result) {
        const list = this.getBookings();
        const idx = list.findIndex((b) => b.id === id);
        if (idx >= 0) {
          list[idx] = result;
          this.saveBookings(list);
          return result;
        }
      }
      return null;
    } catch (e) {
      console.warn('Respond to booking failed:', e);
      return null;
    }
  },

  async updateBooking(id, patch) {
    try {
      const result = await _request('PATCH', '/api/bookings/' + encodeURIComponent(id), patch);
      if (result) {
        const list = this.getBookings();
        const idx = list.findIndex((b) => b.id === id);
        if (idx >= 0) {
          list[idx] = result;
          this.saveBookings(list);
          return result;
        }
      }
      return null;
    } catch (e) {
      console.warn('Update booking failed:', e);
      return null;
    }
  },

  bookingIsUnpaid(booking) {
    if (!booking) return false;
    const status = String(booking.status || '');
    if (status === 'cancelled' || status === 'declined') return false;
    if (booking.type === 'trial') return false;
    const ps = String(booking.paymentStatus || '');
    if (ps === 'paid' || ps === 'waived' || ps === 'refunded') return false;
    if (ps === 'unpaid') return true;
    if (String(booking.escrowStatus || '') === 'pending_payment') return true;
    return false;
  },

  canParentCancelBooking(booking) {
    if (!booking) return false;
    const cancellable = ['pending_accept', 'escrow_locked', 'accepted'];
    if (cancellable.indexOf(booking.status) < 0) return false;
    const sessions = booking.sessions || [];
    if (sessions.some((s) => s && s.status === 'completed')) return false;
    const now = Date.now();
    const lead = 2 * 60 * 60 * 1000;
    const starts = [];
    sessions.forEach((sess) => {
      if (!sess || !sess.date || !sess.timeStart) return;
      const parts = String(sess.timeStart).split(':').map(Number);
      const d = new Date(String(sess.date).slice(0, 10) + 'T00:00:00');
      d.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
      if (!isNaN(d.getTime())) starts.push(d.getTime());
    });
    if (!starts.length && booking.schedule) {
      const iso = String(booking.schedule).match(/(\d{4}-\d{2}-\d{2})/);
      const tm = String(booking.schedule).match(/(\d{1,2}:\d{2})/);
      if (iso && tm) {
        const parts = tm[1].split(':').map(Number);
        const d = new Date(iso[1] + 'T00:00:00');
        d.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
        if (!isNaN(d.getTime())) starts.push(d.getTime());
      }
    }
    if (!starts.length) return booking.status !== 'accepted';
    return now <= Math.min.apply(null, starts) - lead;
  },

  async cancelParentBooking(id) {
    try {
      const result = await _request('POST', '/api/bookings/' + encodeURIComponent(id) + '/cancel', {});
      if (result && result.booking) {
        const list = this.getBookings();
        const idx = list.findIndex((b) => b.id === id);
        if (idx >= 0) {
          list[idx] = result.booking;
          this.saveBookings(list);
        }
        return { ok: true, booking: result.booking, refund: result.refund };
      }
      return result || { ok: false, error: '撤销失败' };
    } catch (e) {
      const data = e && e.data;
      return data || { ok: false, error: (e && e.message) || '撤销失败' };
    }
  },

  async requestSessionLeave(bookingId, sessionId, byRole) {
    try {
      const result = await _request('POST', '/api/bookings/' + encodeURIComponent(bookingId) + '/leave', {
        sessionId,
        action: 'request',
        byRole: byRole || 'parent'
      });
      if (result && result.booking) {
        const list = this.getBookings();
        const idx = list.findIndex((b) => b.id === bookingId);
        if (idx >= 0) {
          list[idx] = result.booking;
          this.saveBookings(list);
        }
      }
      return result;
    } catch (e) {
      return (e && e.data) || { ok: false, error: '请假失败' };
    }
  },

  getParentWalletSummary(parent) {
    if (!parent) {
      return { frozenYuan: 0, hasFrozen: false, label: '资金保障 · 一课一消' };
    }
    const list = this.getBookingsForParent(parent.id);
    const active = ['pending_accept', 'escrow_locked', 'accepted'];
    let frozenYuan = 0;
    list.forEach((b) => {
      if (!b || b.type === 'trial') return;
      if (active.indexOf(b.status) < 0) return;
      const ps = String(b.paymentStatus || '');
      if (ps === 'unpaid' || ps === 'pending' || b.escrowStatus === 'pending_payment') return;
      if (ps === 'paid' || b.escrowStatus === 'frozen') {
        frozenYuan += Number(b.amount) || 0;
      }
    });
    frozenYuan = Math.round(frozenYuan * 100) / 100;
    return {
      frozenYuan,
      hasFrozen: frozenYuan > 0,
      label: '资金保障 · 一课一消'
    };
  },

  async saveAssessment(payload) {
    try {
      return await _request('POST', '/api/assessments', payload || {});
    } catch (e) {
      console.warn('Save assessment failed:', e);
      return null;
    }
  },

  getContracts() { return _readList(KEYS.contracts); },

  async saveContract(contract) {
    try {
      const result = await _request('POST', '/api/contracts', contract);
      if (result) {
        _write(KEYS.contracts, _prepend(this.getContracts(), result));
        return result;
      }
      return null;
    } catch (e) {
      console.warn('Save contract failed:', e);
      return null;
    }
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
      evalGrade: mentor.evalGrade || 'V2 级金牌导师',
      chsiStatus: mentor.chsiStatus || '',
      availableSlots: mentor.availableSlots || [],
      availability: mentor.availability || []
    };
  },

  getTutorListForParent(parentProfile) {
    const parent = parentProfile || this.normalizeParentProfile(this.getParents()[0]);
    const approved = this.getApprovedMentors();
    let tutors = approved.map((m) => this.mentorToTutorCard(m, parent));
    tutors.sort((a, b) => b.matchScore - a.matchScore);
    return tutors;
  },

  setMentorAvailability(mentorId, availability) {
    const normalized = (availability || []).map((item) => ({
      weekday: parseInt(item.weekday, 10),
      ranges: (item.ranges || []).map((r) => ({ start: r.start, end: r.end })).filter((r) => r.start && r.end)
    })).filter((item) => !isNaN(item.weekday) && item.ranges.length);
    const slots = _availabilityToSlotLabels(normalized);
    return this.updateMentorProfile(mentorId, {
      availability: normalized,
      availableSlots: slots
    }, { sensitiveChange: false });
  },

  getMentorAvailability(mentorId) {
    const m = this.getMentorById(mentorId);
    if (!m) return [];
    if (Array.isArray(m.availability) && m.availability.length) return m.availability;
    return _parseSlotLabelToAvailability(m.availableSlots || []);
  },

  sessionFitsMentorAvailability(mentorId, sessions, fallbackAvail) {
    let avail = this.getMentorAvailability(mentorId);
    if ((!avail || !avail.length) && Array.isArray(fallbackAvail) && fallbackAvail.length) {
      avail = fallbackAvail;
    }
    if (!avail.length) return true;
    return (sessions || []).every((s) => {
      let wd = s && s.weekday;
      if ((wd == null || wd === '') && s && s.date) {
        wd = new Date(s.date + 'T12:00:00').getDay();
      }
      wd = parseInt(wd, 10);
      if (isNaN(wd)) return false;
      const start = Avail.timeToMinutes(s && s.timeStart);
      let end = Avail.timeToMinutes(s && s.timeEnd);
      if (start == null) return false;
      if (end == null || end <= start) end = start + 120;
      const day = avail.find((a) => parseInt(a.weekday, 10) === wd);
      if (!day || !day.ranges || !day.ranges.length) return false;
      return day.ranges.some((r) => {
        const rs = Avail.timeToMinutes(r.start);
        const re = Avail.timeToMinutes(r.end);
        return rs != null && re != null && rs <= start && re >= end;
      });
    });
  },

  // Phone-related operations
  async getWeChatPhone(code) {
    try {
      const result = await _request('POST', '/api/wx/phone', { code });
      return result;
    } catch (e) {
      return { success: false, error: e.message || '获取手机号失败' };
    }
  },

  async bindPhone(phone, source) {
    try {
      const result = await _request('POST', '/api/auth/phone/bind', { phone, source });
      return result;
    } catch (e) {
      return { success: false, error: e.message || '绑定失败' };
    }
  },

  async unbindPhone() {
    try {
      const result = await _request('POST', '/api/auth/phone/unbind', {});
      return result;
    } catch (e) {
      return { success: false, error: e.message || '解绑失败' };
    }
  },

  async cancelAccount(reason) {
    try {
      const result = await _request('POST', '/api/auth/phone/cancel', { reason });
      return result;
    } catch (e) {
      return { success: false, error: e.message || '注销失败' };
    }
  },

  async getPhoneAuditStatus() {
    try {
      const result = await _request('GET', '/api/auth/phone/audit', null);
      return result;
    } catch (e) {
      return { success: false, error: e.message || '查询失败' };
    }
  },

  async auditLog(action, source, success) {
    try {
      const result = await _request('POST', '/api/auth/phone/audit', { action, source, success });
      return result;
    } catch (e) {
      console.warn('Audit log failed:', e);
      return { success: false };
    }
  },

  // Booking operations
  async createBooking(bookingData) {
    return this.addBooking(bookingData);
  },

  async fetchBookingsRemote() {
    try {
      const result = await _request('GET', '/api/bookings', null);
      return Array.isArray(result) ? result : [];
    } catch (e) {
      return [];
    }
  },

  wxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) resolve(res.code);
          else reject(new Error('wx.login 未返回 code'));
        },
        fail: (err) => reject(err || new Error('wx.login 失败'))
      });
    });
  },

  async bindWechatSession(wxCode) {
    try {
      const code = wxCode || (await this.wxLoginCode());
      const result = await _request('POST', '/api/wechat/jscode2session', { code });
      return result;
    } catch (e) {
      return { success: false, error: e.message || '微信会话绑定失败' };
    }
  },

  // Payment operations
  async prepayWechat(bookingId, _displayAmountYuan, description, options) {
    try {
      const opts = options || {};
      let wxCode = opts.wxCode;
      if (!wxCode && opts.bindSession !== false) {
        try {
          wxCode = await this.wxLoginCode();
        } catch (loginErr) {
          console.warn('[prepayWechat] wx.login failed', loginErr);
        }
      }
      const result = await _request('POST', '/api/pay/wechat/prepay', {
        bookingId,
        description,
        wxCode
      });
      return Object.assign({ success: true }, result);
    } catch (e) {
      return { success: false, error: e.message || '创建支付订单失败' };
    }
  },

  async mockConfirmPayment(outTradeNo) {
    try {
      const result = await _request('POST', '/api/pay/wechat/mock-confirm', { outTradeNo });
      return result;
    } catch (e) {
      return { success: false, error: e.message || '确认支付失败' };
    }
  },

  async syncPaymentStatus(outTradeNo) {
    try {
      const result = await _request('POST', '/api/pay/wechat/sync', { outTradeNo });
      return Object.assign({ success: true }, result);
    } catch (e) {
      return { success: false, error: e.message || '同步支付状态失败' };
    }
  },

  async waitForPaymentConfirmed(outTradeNo, options) {
    if (!outTradeNo) return { success: false, error: '缺少 outTradeNo' };
    const opts = options || {};
    const maxMs = Number(opts.maxMs) > 0 ? Number(opts.maxMs) : 90000;
    const intervalMs = Number(opts.intervalMs) > 0 ? Number(opts.intervalMs) : 1500;
    const shouldAbort = typeof opts.shouldAbort === 'function' ? opts.shouldAbort : null;
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      if (shouldAbort && shouldAbort()) {
        return { success: false, aborted: true, userDeferred: true, error: '已取消等待支付确认' };
      }
      const result = await this.syncPaymentStatus(outTradeNo);
      if (result && (result.paid || result.status === 'SUCCESS')) {
        return Object.assign({ success: true }, result);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    if (shouldAbort && shouldAbort()) {
      return { success: false, aborted: true, userDeferred: true, error: '已取消等待支付确认' };
    }
    return { success: false, error: '支付确认超时，请稍后在「我的预约」查看' };
  }
};

try {
  StorageService.seedIfEmptyLocal();
} catch (e) {
  console.warn('[StorageService] local seed fail', e);
}

module.exports = StorageService;
