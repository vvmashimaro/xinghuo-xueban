/**
 * 星火学伴 · 统一存储服务（微信小程序）· Token-based Auth
 * Bearer token 认证，scoped endpoints，wx.storage 缓存
 */
'use strict';

const config = require('./config.js');
const API_BASE = (config && config.API_BASE) || 'http://127.0.0.1:8787';

const KEYS = {
  authToken: 'xh_auth_token_v1',
  mentors: 'xh_mentors_v1',
  parents: 'xh_parents_v1',
  bookings: 'xh_bookings_v1',
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

function _request(method, path, body) {
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
          reject(new Error('未授权，请重新登录'));
          wx.reLaunch({ url: '/pages/login/login' });
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error('API ' + res.statusCode + ' ' + path));
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

const StorageService = {
  KEYS,
  API_BASE,
  SPACE_OPTIONS,
  DEFAULT_SLOTS,

  ready() { return _readyPromise; },
  isHydrated() { return _hydrated; },

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

  async verifySMS(phone, code, scene) {
    try {
      const result = await _request('POST', '/api/auth/sms/verify', { phone, code, scene });
      return result;
    } catch (e) {
      return { success: false, error: e.message || '验证失败' };
    }
  },

  async login(ticket, role) {
    try {
      const result = await _request('POST', '/api/auth/login', { ticket, role });
      if (result.success && result.token) {
        this.setAuthToken(result.token);
        return { success: true, user: result.user };
      }
      return { success: false, error: result.error || '登录失败' };
    } catch (e) {
      return { success: false, error: e.message || '登录失败' };
    }
  },

  async register(ticket, role, profile) {
    try {
      const result = await _request('POST', '/api/auth/register', { ticket, role, profile });
      if (result.success && result.token) {
        this.setAuthToken(result.token);
        return { success: true, user: result.user };
      }
      return { success: false, error: result.error || '注册失败' };
    } catch (e) {
      return { success: false, error: e.message || '注册失败' };
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

  async hydrateFromServer() {
    if (!this.isLoggedIn()) {
      console.warn('[StorageService] Not logged in, skipping hydration');
      if (_readyResolve) { _readyResolve(false); _readyResolve = null; }
      return null;
    }

    try {
      const user = await this.getCurrentUser();
      if (!user) {
        if (_readyResolve) { _readyResolve(false); _readyResolve = null; }
        return null;
      }

      const [mentors, parents, bookings] = await Promise.all([
        _apiSafe('GET', '/api/mentors', null) || [],
        _apiSafe('GET', '/api/parents', null) || [],
        _apiSafe('GET', '/api/bookings', null) || []
      ]);

      _write(KEYS.mentors, (mentors || []).map(_withMentorDefaults));
      _write(KEYS.parents, parents || []);
      _write(KEYS.bookings, bookings || []);

      _hydrated = true;
      if (_readyResolve) { _readyResolve(true); _readyResolve = null; }
      return { mentors, parents, bookings };
    } catch (e) {
      console.warn('[StorageService] hydrate fail', e);
      _hydrated = false;
      if (_readyResolve) { _readyResolve(false); _readyResolve = null; }
      return null;
    }
  },

  getMentors() { return _read(KEYS.mentors, []); },
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

  getParents() { return _read(KEYS.parents, []); },

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
    const user = await this.getCurrentUser();
    if (!user || user.role !== 'parent') return null;
    const parents = this.getParents();
    const found = parents.find((p) => p.phone === user.phone) || null;
    return found ? this.normalizeParentProfile(found) : null;
  },

  getBookings() { return _read(KEYS.bookings, []); },
  saveBookings(list) { return _write(KEYS.bookings, list || []); },
  getBookingById(id) { return this.getBookings().find((b) => b.id === id) || null; },

  async addBooking(booking) {
    try {
      const result = await _request('POST', '/api/bookings', booking);
      if (result) {
        const list = this.getBookings();
        list.unshift(result);
        this.saveBookings(list);
        return result;
      }
      return null;
    } catch (e) {
      console.warn('Add booking failed:', e);
      return null;
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
      evalGrade: mentor.evalGrade || 'V2 级金牌导师'
    };
  },

  getTutorListForParent(parentProfile) {
    const parent = parentProfile || this.normalizeParentProfile(_read(KEYS.parents, [])[0]);
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

  // Phone-related operations
  async sendSMS(phone, scene) {
    try {
      const result = await _request('POST', '/api/auth/sms/send', { phone, scene });
      return result;
    } catch (e) {
      return { success: false, error: e.message || '发送失败' };
    }
  },

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
    try {
      const result = await _request('POST', '/api/bookings', bookingData);
      return result;
    } catch (e) {
      return { success: false, error: e.message || '创建预约失败' };
    }
  },

  async getBookings() {
    try {
      const result = await _request('GET', '/api/bookings', null);
      return result;
    } catch (e) {
      return { success: false, error: e.message || '获取预约列表失败' };
    }
  },

  // Payment operations
  async prepayWechat(bookingId, amount, description) {
    try {
      const result = await _request('POST', '/api/pay/wechat/prepay', {
        bookingId,
        amount: Math.round(amount * 100),
        description
      });
      return result;
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
  }
};

module.exports = StorageService;
