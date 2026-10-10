/**
 * 星火学伴 · 微信小程序统一存储服务
 * 与 Web `js/storage-service.js` 对齐：Bearer 认证 + `/api/*` 读写，wx.storage 作缓存
 */
'use strict';

const config = require('./config.js');
const API_BASE = (config && config.API_BASE) || 'https://www.sparkles.com.cn';

const KEYS = {
  authToken: 'xh_auth_token_v1',
  session: 'xh_session_v1',
  mentors: 'xh_mentors_v1',
  parents: 'xh_parents_v1',
  bookings: 'xh_bookings_v1',
  contracts: 'xh_contracts_v1',
  assessments: 'xh_assessments_v1',
  feedbackTickets: 'xh_feedback_tickets_v1',
  seeded: 'xh_seeded_v1',
  featureFlags: 'xh_feature_flags_v1',
  teachingPoints: 'xh_teaching_points_v1'
};

let _readyResolve;
const _readyPromise = new Promise((resolve) => { _readyResolve = resolve; });
let _hydrated = false;
let _cachedMe = null;

function _read(key, fallback) {
  try {
    const raw = wx.getStorageSync(key);
    if (raw === '' || raw == null || raw === undefined) return fallback;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (e) { return raw; }
    }
    return raw;
  } catch (e) {
    return fallback;
  }
}

function _write(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
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
  if (copy.availableSlots == null) copy.availableSlots = DEFAULT_SLOTS.slice();
  if ((!copy.availability || !copy.availability.length) && copy.availableSlots && copy.availableSlots.length) {
    copy.availability = _parseSlotLabelToAvailability(copy.availableSlots);
  }
  if (!copy.preferredSpaces) {
    copy.preferredSpaces = copy.spacePreference ? [copy.spacePreference] : [SPACE_OPTIONS[0]];
  }
  if (copy.bankName == null) copy.bankName = '招商银行';
  if (copy.bankCardNumber == null) copy.bankCardNumber = '';
  if (copy.sensitiveChangePending == null) copy.sensitiveChangePending = false;
  return copy;
}

function _request(method, path, body) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const token = _read(KEYS.authToken, null);
    if (token) headers.Authorization = 'Bearer ' + token;
    wx.request({
      url: API_BASE.replace(/\/$/, '') + path,
      method,
      data: body !== undefined ? body : undefined,
      header: headers,
      success(res) {
        if (res.statusCode === 401) {
          _write(KEYS.authToken, null);
          reject({ status: 401, message: '未授权，请重新登录' });
          wx.reLaunch({ url: '/pages/login/login' });
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({ status: res.statusCode, data: res.data, message: 'API ' + res.statusCode + ' ' + path });
        }
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

function _applySnapshot(snap) {
  if (!snap || typeof snap !== 'object') return;
  if (Array.isArray(snap.mentors)) _write(KEYS.mentors, snap.mentors.map(_withMentorDefaults));
  if (Array.isArray(snap.parents)) _write(KEYS.parents, snap.parents);
  if (Array.isArray(snap.bookings)) _write(KEYS.bookings, snap.bookings);
  if (Array.isArray(snap.contracts)) _write(KEYS.contracts, snap.contracts);
  if (Array.isArray(snap.assessments)) _write(KEYS.assessments, snap.assessments);
}

function _sessionFromAuth(role, userId, phone) {
  const session = {
    role,
    userId,
    phone: phone || '',
    parentId: role === 'parent' ? userId : undefined,
    mentorId: role === 'mentor' ? userId : undefined
  };
  if (role === 'mentor') delete session.parentId;
  if (role === 'parent') delete session.mentorId;
  return session;
}

const StorageService = {
  KEYS,
  API_BASE,
  SPACE_OPTIONS,
  DEFAULT_SLOTS,

  ready() { return _readyPromise; },
  isHydrated() { return _hydrated; },

  getAuthToken() { return _read(KEYS.authToken, null); },
  setAuthToken(token) { _write(KEYS.authToken, token || null); },
  clearAuthToken() { _write(KEYS.authToken, null); },
  isLoggedIn() { return !!this.getAuthToken(); },

  setSession(session) {
    _write(KEYS.session, session || {});
    _apiSafe('PUT', '/api/session', session || {});
    return true;
  },
  getSession() { return _read(KEYS.session, null); },
  clearSession() {
    try { wx.removeStorageSync(KEYS.session); } catch (e) {}
    this.clearAuthToken();
    _cachedMe = null;
    _apiSafe('PUT', '/api/session', {});
  },

  seedIfEmptyLocal() {
    if (!_read(KEYS.mentors, null)) _write(KEYS.mentors, []);
    if (!_read(KEYS.parents, null)) _write(KEYS.parents, []);
    if (!_read(KEYS.bookings, null)) _write(KEYS.bookings, []);
    if (!_read(KEYS.contracts, null)) _write(KEYS.contracts, []);
    if (!_read(KEYS.assessments, null)) _write(KEYS.assessments, []);
    if (!_read(KEYS.feedbackTickets, null)) _write(KEYS.feedbackTickets, []);
    _write(KEYS.seeded, true);
    return true;
  },

  seedIfEmpty() {
    this.seedIfEmptyLocal();
    if (!_hydrated && this.isLoggedIn()) {
      this.hydrateFromServer();
    }
    return true;
  },

  async resetDemoData() {
    const snap = await _apiSafe('POST', '/api/reset');
    if (snap) {
      _applySnapshot(snap);
      return true;
    }
    _write(KEYS.mentors, []);
    _write(KEYS.parents, []);
    _write(KEYS.bookings, []);
    _write(KEYS.contracts, []);
    _write(KEYS.assessments, []);
    return true;
  },

  async sendSMS(phone, scene) {
    try {
      return await _request('POST', '/api/auth/sms/send', { phone, scene });
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '发送失败' };
    }
  },

  async verifySMS(phone, code, scene) {
    try {
      return await _request('POST', '/api/auth/sms/verify', { phone, code, scene: scene || 'login' });
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '验证失败' };
    }
  },

  async login(ticket, role, clientPhone) {
    try {
      const result = await _request('POST', '/api/auth/login', { ticket, role });
      if (result.success && result.token) {
        this.setAuthToken(result.token);
        const phone = clientPhone || (result.user && result.user.phone) || '';
        this.setSession(_sessionFromAuth(role, result.user.id, phone));
        return { success: true, user: Object.assign({}, result.user, { role, phone }) };
      }
      return { success: false, error: result.error || '登录失败' };
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '登录失败' };
    }
  },

  async register(ticket, role, profile) {
    try {
      const result = await _request('POST', '/api/auth/register', { ticket, role, profile });
      if (result.success && result.token) {
        this.setAuthToken(result.token);
        const phone = (profile && profile.phone) || (result.user && result.user.phone) || '';
        this.setSession(_sessionFromAuth(role, result.user.id, phone));
        const savedProfile = (result.user && result.user.profile) || profile;
        if (role === 'parent' && savedProfile) {
          this.saveParent(savedProfile);
        } else if (role === 'mentor' && savedProfile) {
          this.addMentor(savedProfile);
        }
        await this.hydrateFromServer();
      }
      return result;
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '注册失败' };
    }
  },

  async logout() {
    try { await _request('POST', '/api/auth/logout', {}); } catch (e) {}
    this.clearSession();
  },

  async getCurrentUser() {
    try {
      const result = await _request('GET', '/api/auth/me', null);
      _cachedMe = result;
      if (result && result.profile && result.role === 'parent') {
        const parents = this.getParents();
        const idx = parents.findIndex((p) => p.id === result.profile.id);
        if (idx >= 0) parents[idx] = result.profile;
        else parents.unshift(result.profile);
        _write(KEYS.parents, parents);
      }
      return result;
    } catch (e) {
      return _cachedMe;
    }
  },

  async hydrateFromServer() {
    if (!this.isLoggedIn()) {
      if (_readyResolve) { _readyResolve(false); _readyResolve = null; }
      return null;
    }
    try {
      await this.getCurrentUser();
      const [mentors, parents, bookings, contracts, assessments, feedback] = await Promise.all([
        _apiSafe('GET', '/api/mentors'),
        _apiSafe('GET', '/api/parents'),
        _apiSafe('GET', '/api/bookings'),
        _apiSafe('GET', '/api/contracts'),
        _apiSafe('GET', '/api/assessments'),
        _apiSafe('GET', '/api/feedback')
      ]);
      if (Array.isArray(mentors)) _write(KEYS.mentors, mentors.map(_withMentorDefaults));
      if (Array.isArray(parents)) _write(KEYS.parents, parents);
      if (Array.isArray(bookings)) _write(KEYS.bookings, bookings);
      if (Array.isArray(contracts)) _write(KEYS.contracts, contracts);
      if (Array.isArray(assessments)) _write(KEYS.assessments, assessments);
      if (Array.isArray(feedback)) _write(KEYS.feedbackTickets, feedback);
      await this.fetchFeatureFlags();
      await this.fetchTeachingPoints();
      _hydrated = true;
      if (_readyResolve) { _readyResolve(true); _readyResolve = null; }
      return { mentors, parents, bookings };
    } catch (e) {
      _hydrated = false;
      if (_readyResolve) { _readyResolve(false); _readyResolve = null; }
      return null;
    }
  },

  async fetchSubjectCatalog() {
    try {
      const catalog = await _request('GET', '/api/subject-catalog', null);
      return catalog;
    } catch (e) {
      return null;
    }
  },

  async fetchFeatureFlags() {
    try {
      const flags = await _request('GET', '/api/feature-flags', null);
      if (flags) _write(KEYS.featureFlags, flags);
      return flags;
    } catch (e) {
      return _read(KEYS.featureFlags, null);
    }
  },

  getFeatureFlags() {
    const cached = _read(KEYS.featureFlags, null);
    return Object.assign(
      {
        FEATURE_SMART_WAREHOUSE: config.FEATURE_SMART_WAREHOUSE === true,
        PAY_MODE: config.PAY_MODE || 'demo',
        SMS_MODE: config.SMS_MODE || 'demo'
      },
      cached || {}
    );
  },

  async fetchTeachingPoints() {
    if (!this.isLoggedIn()) return [];
    try {
      const points = await _request('GET', '/api/teaching-points', null);
      if (Array.isArray(points)) {
        _write(KEYS.teachingPoints, points);
        return points;
      }
    } catch (e) {}
    return _read(KEYS.teachingPoints, []);
  },

  getTeachingPoints() {
    return _read(KEYS.teachingPoints, []);
  },

  getBoothOptionsForSpace(spaceName) {
    const points = this.getTeachingPoints();
    const space = String(spaceName || '');
    const tp = points.find((p) => p.name === space) ||
      points.find((p) => space && (space.indexOf(p.name) >= 0 || p.name.indexOf(space) >= 0));
    const booths = (tp && tp.booths) || [
      { id: 'booth-1', label: '仓位 1' },
      { id: 'booth-2', label: '仓位 2' },
      { id: 'booth-3', label: '仓位 3' }
    ];
    return [{ id: '', label: '系统自动分配空闲仓位' }].concat(
      booths.map((b) => ({ id: b.id || '', label: b.label || '仓位' }))
    );
  },

  async matchTutorsRemote(parentProfile) {
    if (!this.isLoggedIn()) return null;
    return _apiSafe('POST', '/api/tutors/match', parentProfile || {});
  },

  getMentors() {
    this.seedIfEmptyLocal();
    return _read(KEYS.mentors, []);
  },
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
      const m = this.getMentorById(session.mentorId);
      if (m) return m;
    }
    if (session.phone) return this.getMentorByPhone(session.phone);
    if (_cachedMe && _cachedMe.profile && _cachedMe.role === 'mentor') {
      return _withMentorDefaults(_cachedMe.profile);
    }
    return null;
  },

  async updateMentorProfile(id, patch, options) {
    try {
      const result = await _request('PATCH', '/api/mentors/' + encodeURIComponent(id), {
        ...(patch || {}),
        _options: options || {}
      });
      if (result) {
        const list = this.getMentors();
        const idx = list.findIndex((m) => m.id === id);
        const next = _withMentorDefaults(result);
        if (idx >= 0) list[idx] = next;
        else list.unshift(next);
        this.saveMentors(list);
        return next;
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  addMentor(mentor) {
    const list = this.getMentors();
    const record = Object.assign({
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
  getApprovedMentors() {
    return this.getMentors().filter((m) => m.status === 'approved' && m.acceptingOrders !== false);
  },

  getParents() {
    this.seedIfEmptyLocal();
    return _read(KEYS.parents, []);
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
        out.subjects.forEach((s, i) => {
          out.subjectPlans[s] = {
            weakPoints: i === 0 ? topics.slice() : [],
            pacing,
            pains: i === 0 ? pains.slice() : []
          };
        });
      }
    }
    if (!Array.isArray(out.syllabusTopics)) {
      const flat = [];
      Object.keys(out.subjectPlans).forEach((s) => {
        (out.subjectPlans[s].weakPoints || []).forEach((t) => {
          if (flat.indexOf(t) < 0) flat.push(t);
        });
      });
      out.syllabusTopics = flat;
    }
    if (!Array.isArray(out.painTags)) {
      const flat = [];
      Object.keys(out.subjectPlans).forEach((s) => {
        (out.subjectPlans[s].pains || []).forEach((pain) => {
          if (flat.indexOf(pain) < 0) flat.push(pain);
        });
      });
      out.painTags = flat;
    }
    return out;
  },

  getCurrentParent() {
    this.seedIfEmptyLocal();
    const session = this.getSession();
    const list = this.getParents();
    let found = null;
    if (session && session.parentId) {
      found = list.find((p) => p.id === session.parentId) || null;
    }
    if (!found && session && session.userId && session.role === 'parent') {
      found = list.find((p) => p.id === session.userId) || null;
    }
    if (!found && session && session.phone) {
      const phone = String(session.phone).trim();
      found = list.find((p) => p.phone && String(p.phone).trim() === phone) || null;
    }
    if (!found && _cachedMe && _cachedMe.profile && _cachedMe.role === 'parent') {
      found = _cachedMe.profile;
    }
    return found ? this.normalizeParentProfile(found) : null;
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
      list.unshift(record);
    }
    _write(KEYS.parents, list);
    const session = this.getSession() || {};
    session.role = 'parent';
    session.parentId = record.id;
    session.userId = record.id;
    session.phone = record.phone;
    this.setSession(session);
    _apiSafe('POST', '/api/parents', record).then((remote) => {
      if (remote) {
        const all = this.getParents();
        let i = all.findIndex((p) => p.id === record.id);
        if (i < 0 && remote.phone) {
          i = all.findIndex((p) => p.phone === remote.phone);
        }
        if (i >= 0) all[i] = remote;
        else all.unshift(remote);
        _write(KEYS.parents, all);
      }
    });
    return record;
  },

  getBookings() {
    this.seedIfEmptyLocal();
    return _read(KEYS.bookings, []);
  },
  saveBookings(list) { return _write(KEYS.bookings, list || []); },
  getBookingById(id) { return this.getBookings().find((b) => b.id === id) || null; },

  async addBooking(booking) {
    const payload = Object.assign({}, booking || {}, {
      mentorId: (booking && (booking.mentorId || booking.tutorId)) || '',
      tutorId: (booking && (booking.tutorId || booking.mentorId)) || '',
      status: (booking && booking.status) || 'pending_accept'
    });
    try {
      const remote = await _request('POST', '/api/bookings', payload);
      if (remote && remote.ok === false) return remote;
      if (!remote || !remote.id) {
        return {
          ok: false,
          error: (remote && remote.error) || '创建预约失败',
          code: remote && remote.code,
          conflicts: remote && remote.conflicts
        };
      }
      const list = this.getBookings();
      list.unshift(remote);
      this.saveBookings(list);
      return remote;
    } catch (e) {
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
        if (idx >= 0) list[idx] = result;
        else list.unshift(result);
        this.saveBookings(list);
        return result;
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  async updateBooking(id, patch) {
    try {
      const result = await _request('PATCH', '/api/bookings/' + encodeURIComponent(id), patch);
      if (result) {
        const list = this.getBookings();
        const idx = list.findIndex((b) => b.id === id);
        if (idx >= 0) list[idx] = result;
        this.saveBookings(list);
        return result;
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  getContracts() { return _read(KEYS.contracts, []); },

  async saveContract(contract) {
    try {
      const result = await _request('POST', '/api/contracts', contract);
      if (result) {
        const list = this.getContracts();
        list.unshift(result);
        _write(KEYS.contracts, list);
        return result;
      }
      return null;
    } catch (e) {
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
      Object.keys(parentNorm.subjectPlans).forEach((s) => {
        (parentNorm.subjectPlans[s].weakPoints || []).forEach((t) => {
          if (parentTopics.indexOf(t) < 0) parentTopics.push(t);
        });
      });
    }
    const budgetMin = Number(parentNorm.budgetMin) || 80;
    const budgetMax = Number(parentNorm.budgetMax) || 180;
    const budget = Number(parentNorm.budgetRate) || Math.round((budgetMin + budgetMax) / 2);
    const preferredSpace = parentNorm.selectedSpace || mentor.spacePreference || SPACE_OPTIONS[0];
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
    const syllabusTopics = parentTopics.length > 0
      ? parentTopics.slice(0, 3)
      : (mentor.styles || []).slice(0, 3).concat(['考纲高频模型拆解']).slice(0, 3);
    const shortUni = (mentor.university || '').split(/[·/]/)[0].trim();
    const degreeShort = shortUni
      ? shortUni.replace('大学', '').slice(0, 6) + '·' + (subjects[0] || '辅导').replace(/初中|高中|小学/g, '').slice(0, 4)
      : '合规导师';
    return {
      id: 'TUTOR-' + (mentor.code || mentor.id || surname),
      mentorId: mentor.id,
      realName: mentor.realName,
      maskedName: surname + '老师',
      avatarLetter: surname,
      university: mentor.university,
      degree: mentor.degree || '',
      degreeShort,
      subjects,
      hourlyRate: Number(mentor.hourlyRate) || 120,
      rating: mentor.status === 'approved' ? 4.9 : 4.7,
      reviewCount: 20 + Math.floor((mentor.hourlyRate || 100) / 5),
      totalHours: 60 + Math.floor((mentor.hourlyRate || 100) / 2),
      space: mentor.spacePreference || preferredSpace,
      matchScore,
      scoreHighlight: mentor.scoreHighlight || '合规实名 · 学信网核验通过',
      styles: mentor.styles && mentor.styles.length ? mentor.styles : ['引导启发解题'],
      syllabusTopics,
      videoTitle: (subjects[0] || '学科') + ' · 试讲示范课',
      lectureUrl: mentor.lectureUrl || '#',
      isTopMatch: matchScore >= 95,
      tagBadge: matchScore >= 96 ? matchScore + '% AI高契合' : mentor.evalGrade || '金牌导师',
      evalGrade: mentor.evalGrade || 'V2 级金牌导师'
    };
  },

  getTutorListForParent(parentProfile) {
    const parent = parentProfile || this.getCurrentParent();
    const approved = this.getApprovedMentors();
    let tutors = approved.map((m) => this.mentorToTutorCard(m, parent));
    tutors.sort((a, b) => b.matchScore - a.matchScore);
    if (parent) {
      this.matchTutorsRemote(parent).then((remote) => {
        if (remote && Array.isArray(remote) && remote.length) {
          console.log('[StorageService] server match', remote.length, 'tutors');
        }
      });
    }
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

  async getWeChatPhone(code) {
    try {
      return await _request('POST', '/api/wx/phone', { code });
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '获取手机号失败' };
    }
  },

  async bindPhone(phone, source) {
    try {
      return await _request('POST', '/api/auth/phone/bind', { phone, source });
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '绑定失败' };
    }
  },

  async unbindPhone() {
    try {
      return await _request('POST', '/api/auth/phone/unbind', {});
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '解绑失败' };
    }
  },

  async cancelAccount(reason) {
    try {
      return await _request('POST', '/api/auth/phone/cancel', { reason });
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '注销失败' };
    }
  },

  async auditLog(action, source, success) {
    try {
      return await _request('POST', '/api/auth/phone/audit', { action, source, success });
    } catch (e) {
      return { success: false };
    }
  },

  async prepayWechat(bookingId, _displayAmountYuan, description) {
    try {
      return await _request('POST', '/api/pay/wechat/prepay', { bookingId, description });
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '创建支付订单失败' };
    }
  },

  async mockConfirmPayment(outTradeNo) {
    try {
      return await _request('POST', '/api/pay/wechat/mock-confirm', { outTradeNo });
    } catch (e) {
      return { success: false, error: (e.data && e.data.error) || e.message || '确认支付失败' };
    }
  },

  getFeedbackTickets() { return _read(KEYS.feedbackTickets, []) || []; },

  async submitFeedback(record) {
    const result = await _apiSafe('POST', '/api/feedback', record);
    if (result) {
      const list = this.getFeedbackTickets();
      list.unshift(result);
      _write(KEYS.feedbackTickets, list);
    }
    return result;
  }
};

module.exports = StorageService;
