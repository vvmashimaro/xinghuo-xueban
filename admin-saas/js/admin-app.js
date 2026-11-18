/**
 * 星火运营中台 · SPA 路由与页面
 */
(function () {
  'use strict';

  const STATUS_LABEL = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回',
    supplement: '待补材料'
  };

  const MENTOR_EVAL_GRADES = [
    '待教研评级',
    'V1 级标准导师',
    'V2 级金牌导师',
    'V3 级首席导师',
    '待复评',
    '不予评级'
  ];

  const RUBRIC_DIMENSIONS = [
    { key: 'credential', label: '资质与合规' },
    { key: 'demo', label: '试讲与授课表现' },
    { key: 'subject', label: '学科专业度' },
    { key: 'communication', label: '沟通与服务意识' },
    { key: 'safety', label: '安全与履约风险' }
  ];

  const BOOKING_STATUS_ZH = {
    pending_accept: '待导师接单',
    accepted: '已接单',
    declined: '已拒绝',
    cancelled: '已取消',
    escrow_locked: '托管锁定',
    completed: '已完成'
  };

  let state = {
    route: 'dashboard',
    mentors: [],
    parents: [],
    bookings: [],
    contracts: [],
    assessments: [],
    payOrders: [],
    feedback: [],
    flags: {},
    selectedMentorId: null,
    auditFilter: 'pending',
    feedbackFilter: 'all',
    bookingListFilter: 'all',
    subjectTagFilter: '',
    subjectCatalog: null,
    teachingPoints: [],
    teachingPointsLoaded: false,
    tpOccupancyDate: '',
    tpOccupancyTpId: '',
    tpOccupancy: null,
    adminLabel: '管理员',
    payFilters: {
      from: '',
      to: '',
      mentorName: '',
      studentName: '',
      phone: '',
      outTradeNo: '',
      status: '',
      limit: 200
    },
    selectedAssessmentId: null,
    assessmentDetail: null,
    bookingDetailId: null,
    adminRbac: { modules: [], isSuperAdmin: false, isPrimaryAdmin: false, catalog: [] },
    rbacStaff: [],
    rbacDraft: {},
    parentFormOpen: false,
    parentDraft: { phone: '', parentName: '', studentNickname: '', studentGrade: '', parentRole: '家长' },
    mentorFormOpen: false,
    mentorDraft: { phone: '', realName: '', university: '', hourlyRate: '' },
    teachingPointFormOpen: false,
    teachingPointDraftName: ''
  };

  function isPrimaryAdminUser() {
    return !!(state.adminRbac && (state.adminRbac.isPrimaryAdmin || state.adminRbac.isSuperAdmin));
  }

  function confirmAction(opts) {
    const modal = document.getElementById('adminConfirmModal');
    const title = document.getElementById('adminConfirmTitle');
    const message = document.getElementById('adminConfirmMessage');
    const okBtn = document.getElementById('adminConfirmOk');
    const cancelBtn = document.getElementById('adminConfirmCancel');
    const backdrop = document.getElementById('adminConfirmBackdrop');
    const text = (opts && opts.message) || '确认删除？';
    if (!modal || !okBtn || !cancelBtn || !title || !message) {
      return Promise.resolve(window.confirm(text));
    }
    title.textContent = (opts && opts.title) || '确认删除';
    message.textContent = text;
    okBtn.textContent = (opts && opts.confirmLabel) || '确认删除';
    modal.classList.remove('hidden');
    return new Promise((resolve) => {
      const finish = (value) => {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        if (backdrop) backdrop.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
        resolve(value);
      };
      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onKey = (e) => {
        if (e.key === 'Escape') onCancel();
      };
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      if (backdrop) backdrop.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);
      okBtn.focus();
    });
  }

  const RELOGIN_ADMIN = '当前登录已不是管理员，请重新登录中台';

  function isPrimarySession(me) {
    return !!(me && me.adminRbac && (me.adminRbac.isPrimaryAdmin || me.adminRbac.isSuperAdmin));
  }

  function identityText(me) {
    if (!me) return '未登录';
    const phone = me.phone || '';
    let who = '其他账号';
    if (me.role === 'admin') who = isPrimarySession(me) ? '主管理员' : '管理员';
    else if (me.role === 'parent') who = '当前是家长登录';
    else if (me.role === 'mentor') who = '当前是导师登录';
    else if (me.role) who = String(me.role);
    return phone ? who + ' · ' + phone : who;
  }

  function paintIdentity(me) {
    const text = identityText(me);
    state.adminLabel = text;
    const identity = document.getElementById('adminIdentity');
    const side = document.getElementById('adminUserLabel');
    const status = document.getElementById('adminSessionStatus');
    const note = document.getElementById('adminSessionNote');
    const relogin = document.getElementById('adminRelogin');
    const bar = document.getElementById('adminTopBar');
    if (identity) identity.textContent = text;
    if (side) side.textContent = text;
    const adminSession = !!(me && me.role === 'admin');
    if (adminSession) {
      if (status) {
        status.textContent = isPrimarySession(me) ? '主管理员会话' : '管理员会话';
        status.className =
          'shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200';
      }
      if (note) {
        note.textContent = '';
        note.classList.add('hidden');
      }
      if (relogin) relogin.classList.add('hidden');
      if (bar) {
        bar.className =
          'shrink-0 bg-white border-b border-slate-200 px-6 lg:px-8 py-3 flex items-center justify-between gap-3';
      }
      return;
    }
    const replacedBy = me && me.role === 'mentor' ? '导师' : me && me.role === 'parent' ? '家长' : '';
    if (status) {
      status.textContent = '会话已不是管理员';
      status.className =
        'shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200';
    }
    if (note) {
      note.textContent = replacedBy
        ? '当前会话已被' + replacedBy + '登录覆盖。' + RELOGIN_ADMIN
        : RELOGIN_ADMIN;
      note.classList.remove('hidden');
    }
    if (relogin) relogin.classList.remove('hidden');
    if (bar) {
      bar.className =
        'shrink-0 bg-rose-50 border-b border-rose-200 px-6 lg:px-8 py-3 flex items-center justify-between gap-3';
    }
  }

  function refreshIdentityAfterTakeover() {
    if (!window.StorageService || typeof StorageService.getCurrentUser !== 'function') return;
    if (refreshIdentityAfterTakeover._busy) return;
    refreshIdentityAfterTakeover._busy = true;
    StorageService.getCurrentUser()
      .then((me) => paintIdentity(me))
      .catch(() => {})
      .then(() => {
        refreshIdentityAfterTakeover._busy = false;
      });
  }

  function apiErrorMessage(e, fallback) {
    const raw = (e && e.data && e.data.error) || (e && e.message) || fallback || '操作失败';
    if (raw === '需要管理员权限' || raw === RELOGIN_ADMIN) {
      refreshIdentityAfterTakeover();
      return RELOGIN_ADMIN;
    }
    return raw;
  }

  function hasAdminModule(key) {
    if (state.adminRbac && (state.adminRbac.isSuperAdmin || state.adminRbac.isPrimaryAdmin)) return true;
    const mods = (state.adminRbac && state.adminRbac.modules) || [];
    return mods.indexOf(key) >= 0;
  }

  function firstAllowedRoute() {
    const order = [
      'dashboard',
      'audit',
      'payments',
      'feedback',
      'bookings',
      'parents',
      'mentors',
      'contracts',
      'assessments',
      'teaching-points',
      'system',
      'permissions'
    ];
    for (let i = 0; i < order.length; i += 1) {
      if (hasAdminModule(order[i])) return order[i];
    }
    return '';
  }

  function applyNavPermissions() {
    document.querySelectorAll('[data-nav]').forEach((el) => {
      const key = el.getAttribute('data-nav');
      const allowed = hasAdminModule(key);
      el.classList.toggle('hidden', !allowed);
    });
    document.querySelectorAll('.admin-nav-group').forEach((group) => {
      let visible = false;
      let sib = group.nextElementSibling;
      while (sib && !sib.classList.contains('admin-nav-group')) {
        if (sib.matches('[data-nav]') && !sib.classList.contains('hidden')) visible = true;
        sib = sib.nextElementSibling;
      }
      group.classList.toggle('hidden', !visible);
    });
  }

  function todayIso() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function subjectCatalogChips() {
    const cat = state.subjectCatalog || {};
    const chips = [];
    (cat.topLevelGradeBands || []).forEach((g) => chips.push({ label: g, value: g }));
    (cat.parentTargetSubjects || []).forEach((s) => {
      if (chips.some((c) => c.value === s)) return;
      chips.push({ label: s, value: s });
    });
    (cat.mentorSubjectOptions || []).slice(0, 8).forEach((s) => {
      if (chips.length > 16) return;
      if (chips.some((c) => c.value === s)) return;
      chips.push({ label: s, value: s });
    });
    return chips;
  }

  function subjectFilterBarHtml() {
    const chips = subjectCatalogChips();
    if (!chips.length) {
      return '<p class="text-xs text-slate-500">学科目录加载中…</p>';
    }
    return (
      '<div class="flex flex-wrap gap-2 items-center">' +
      '<span class="text-xs text-slate-500 font-bold">学科筛选（目录）：</span>' +
      '<button type="button" data-subject-filter="" class="text-xs px-2.5 py-1 rounded-lg ' +
      (!state.subjectTagFilter ? 'bg-slate-900 text-white' : 'bg-slate-100') +
      '">全部</button>' +
      chips
        .map((c) => {
          const on = state.subjectTagFilter === c.value;
          return (
            '<button type="button" data-subject-filter="' +
            esc(c.value) +
            '" class="text-xs px-2.5 py-1 rounded-lg ' +
            (on ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700') +
            '">' +
            esc(c.label) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function matchesSubjectTag(text, tag) {
    if (!tag) return true;
    return String(text || '').toLowerCase().indexOf(String(tag).toLowerCase()) >= 0;
  }

  function bookingConflictBadge(b) {
    if (!b || !b.hasTimeConflict) return '';
    const note = b.timeConflictNote || '与学员其他课程时间冲突';
    return (
      '<span class="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900" title="' +
      esc(note) +
      '">' +
      (b.timeConflictForced ? '强制约课' : '时间冲突') +
      '</span>'
    );
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function apiBase() {
    return (window.XH_CONFIG && window.XH_CONFIG.API_BASE) || 'http://127.0.0.1:8787';
  }

  function normalizeTeachingPoints(raw) {
    return Array.isArray(raw) ? raw : [];
  }

  function proofFileHref(file) {
    if (!file) return '';
    if (file.url) {
      const u = String(file.url);
      if (/^https?:\/\//i.test(u)) return u;
      return apiBase().replace(/\/$/, '') + (u.startsWith('/') ? u : '/' + u);
    }
    if (file.storedName) {
      return apiBase().replace(/\/$/, '') + '/uploads/proofs/' + encodeURIComponent(file.storedName);
    }
    return '';
  }

  function externalLinkHtml(url, label) {
    const u = String(url || '').trim();
    if (!u || u === '#') return '<span class="text-slate-400">—</span>';
    return (
      '<a href="' +
      esc(u) +
      '" target="_blank" rel="noopener noreferrer" class="text-teal-700 font-medium break-all hover:underline">' +
      esc(label || u) +
      '</a>'
    );
  }

  function toast(msg, type) {
    const el = document.getElementById('adminToast');
    const text = document.getElementById('adminToastText');
    if (!el || !text) return;
    text.textContent = msg;
    el.className =
      'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition ' +
      (type === 'error' ? 'bg-rose-600 text-white' : type === 'warn' ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white');
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  async function ensureAdmin() {
    if (!window.StorageService || !StorageService.isLoggedIn()) {
      window.location.href = '../login.html';
      return false;
    }
    await StorageService.ready();
    const me = await StorageService.getCurrentUser();
    paintIdentity(me);
    if (!me) {
      window.location.href = '../login.html';
      return false;
    }
    if (me.role !== 'admin') {
      const main = document.getElementById('adminMain');
      if (main) {
        main.innerHTML =
          '<div class="max-w-lg space-y-3">' +
          '<h1 class="text-xl font-semibold text-slate-900">' +
          RELOGIN_ADMIN +
          '</h1>' +
          '<p class="text-sm text-slate-600">顶栏标出当前会话。家长或导师登录会覆盖原来的管理员令牌。</p>' +
          '<a href="../login.html" class="inline-flex text-sm bg-rose-600 text-white px-4 py-2 rounded-xl font-bold">重新登录中台</a>' +
          '</div>';
      }
      return false;
    }
    if (me.adminRbac) {
      state.adminRbac = me.adminRbac;
    } else {
      try {
        state.adminRbac = await AdminApi.getAdminRbacMe();
      } catch (e) {
        state.adminRbac = { modules: [], isSuperAdmin: false, catalog: [] };
      }
      me.adminRbac = state.adminRbac;
    }
    paintIdentity(me);
    applyNavPermissions();
    return true;
  }

  async function reloadCore() {
    if (hasAdminModule('dashboard') || hasAdminModule('audit') || hasAdminModule('mentors')) {
      try {
        const mentors = await AdminApi.get('/api/mentors');
        if (Array.isArray(mentors) && window.localStorage) {
          localStorage.setItem('xh_mentors_v1', JSON.stringify(mentors));
        }
        state.mentors = Array.isArray(mentors) ? mentors : StorageService.getMentors();
      } catch (e) {
        state.mentors = StorageService.getMentors();
      }
    } else {
      state.mentors = [];
    }
    if (hasAdminModule('parents')) {
      try {
        const parents = await AdminApi.get('/api/parents');
        state.parents = Array.isArray(parents) ? parents : [];
      } catch (e) {
        state.parents = [];
      }
    } else {
      state.parents = [];
    }
    if (hasAdminModule('dashboard') || hasAdminModule('bookings')) {
      try {
        const bookings = await AdminApi.get('/api/bookings');
        state.bookings = Array.isArray(bookings) ? bookings : [];
      } catch (e) {
        state.bookings = [];
      }
    } else {
      state.bookings = [];
    }
    if (hasAdminModule('contracts')) {
      try {
        const contracts = await AdminApi.get('/api/contracts');
        state.contracts = Array.isArray(contracts) ? contracts : [];
      } catch (e) {
        state.contracts = [];
      }
    } else {
      state.contracts = [];
    }
    if (hasAdminModule('assessments')) {
      try {
        const assessments = await AdminApi.get('/api/assessments');
        state.assessments = Array.isArray(assessments) ? assessments : [];
      } catch (e) {
        state.assessments = [];
      }
    } else {
      state.assessments = [];
    }
    if (hasAdminModule('dashboard') || hasAdminModule('feedback')) {
      try {
        const feedback = await AdminApi.listFeedback();
        state.feedback = Array.isArray(feedback) ? feedback : [];
      } catch (e) {
        state.feedback = [];
      }
    } else {
      state.feedback = [];
    }
    if (hasAdminModule('payments')) {
      try {
        const payRes = await AdminApi.listPayOrders({});
        state.payOrders = (payRes && payRes.orders) || payRes || [];
      } catch (e) {
        state.payOrders = [];
      }
    } else {
      state.payOrders = [];
    }
    try {
      state.subjectCatalog = await AdminApi.getSubjectCatalog();
    } catch (e) {
      state.subjectCatalog = null;
    }
    if (hasAdminModule('system')) {
      try {
        const flagRes = await AdminApi.getFeatureFlags();
        state.flags = flagRes || {};
      } catch (e) {
        state.flags = { FEATURE_SMART_WAREHOUSE: false };
      }
    } else {
      state.flags = { FEATURE_SMART_WAREHOUSE: false };
    }
    if (hasAdminModule('teaching-points')) {
      try {
        state.teachingPoints = normalizeTeachingPoints(await AdminApi.listTeachingPoints());
        state.teachingPointsLoaded = true;
      } catch (e) {
        state.teachingPoints = [];
        state.teachingPointsLoaded = false;
      }
    } else {
      state.teachingPoints = [];
    }
    if (!state.tpOccupancyDate) state.tpOccupancyDate = todayIso();
    if (!state.tpOccupancyTpId && state.teachingPoints[0]) {
      state.tpOccupancyTpId = state.teachingPoints[0].id;
    }
  }

  function renderNoModuleAccess() {
    const main = document.getElementById('adminMain');
    if (!main) return;
    main.innerHTML =
      '<div class="max-w-lg space-y-3">' +
      '<h1 class="text-xl font-semibold text-slate-900">暂无可用模块</h1>' +
      '<p class="text-sm text-slate-600">您的管理员账号尚未开通任何运营模块。请联系主管理员（13540012341）在「权限设置」中勾选授权。</p>' +
      '</div>';
  }

  async function loadRbacStaff() {
    const res = await AdminApi.listAdminRbacStaff();
    state.rbacStaff = res.staff || [];
    state.rbacDraft = {};
    state.rbacStaff.forEach((row) => {
      state.rbacDraft[row.phone] = (row.modules || []).slice();
    });
    if (res.catalog && res.catalog.length) {
      state.adminRbac.catalog = res.catalog;
    }
  }

  function setRoute(route) {
    let next = route || 'dashboard';
    if (next && !hasAdminModule(next)) {
      const fallback = firstAllowedRoute();
      if (!fallback) {
        state.route = '';
        applyNavPermissions();
        renderNoModuleAccess();
        return;
      }
      next = fallback;
      toast('当前账号无权访问该模块', 'warn');
    }
    state.route = next;
    if (next === 'audit' && !state.selectedMentorId) {
      const pending = state.mentors.find((m) => m.status === 'pending');
      if (pending) state.selectedMentorId = pending.id;
    }
    window.location.hash = '#' + state.route;
    document.querySelectorAll('[data-nav]').forEach((el) => {
      const on = el.getAttribute('data-nav') === state.route;
      el.classList.toggle('bg-teal-600', on);
      el.classList.toggle('text-white', on);
      el.classList.toggle('text-slate-300', !on);
    });
    if (state.route === 'permissions') {
      loadRbacStaff()
        .then(() => renderMain())
        .catch((e) => {
          toast(e.message || '加载权限配置失败', 'error');
          renderMain();
        });
      return;
    }
    renderMain();
  }

  function renderMain() {
    const main = document.getElementById('adminMain');
    if (!main) return;
    const r = state.route;
    if (r === 'dashboard') main.innerHTML = renderDashboard();
    else if (r === 'audit') main.innerHTML = renderAudit();
    else if (r === 'parents') main.innerHTML = renderParents();
    else if (r === 'mentors') main.innerHTML = renderMentorsList();
    else if (r === 'bookings') main.innerHTML = renderBookings();
    else if (r === 'teaching-points') main.innerHTML = renderTeachingPoints();
    else if (r === 'contracts') main.innerHTML = renderContracts();
    else if (r === 'assessments') main.innerHTML = renderAssessments();
    else if (r === 'payments') main.innerHTML = renderPayments();
    else if (r === 'feedback') main.innerHTML = renderFeedback();
    else if (r === 'system') main.innerHTML = renderSystem();
    else if (r === 'permissions') main.innerHTML = renderPermissions();
    else main.innerHTML = '<p class="text-slate-500">页面不存在</p>';
    bindMainHandlers();
    syncBookingDetailModal();
  }

  function renderDashboard() {
    const pending = state.mentors.filter((m) => m.status === 'pending').length;
    const openFb = state.feedback.filter((t) => t.status === '待处理' || t.status === '处理中').length;
    const recentBk = state.bookings.slice(0, 5);
    return (
      '<div class="space-y-6">' +
      '<h1 class="text-xl font-semibold text-slate-900">运营总览</h1>' +
      '<div class="grid sm:grid-cols-3 gap-4">' +
      cardStat('待审核导师', pending, 'amber') +
      cardStat('待处理反馈', openFb, 'blue') +
      cardStat('预约总数', state.bookings.length, 'teal') +
      '</div>' +
      '<section class="bg-white rounded-2xl border border-slate-200 p-5">' +
      '<h2 class="font-bold text-slate-800 mb-3">最近预约</h2>' +
      (recentBk.length
        ? '<ul class="text-sm space-y-2">' +
          recentBk
            .map(
              (b) =>
                '<li><button type="button" data-open-booking="' +
                esc(b.id) +
                '" class="w-full text-left flex justify-between gap-2 border-b border-slate-100 pb-2 hover:bg-slate-50 rounded-lg px-1 -mx-1 transition">' +
                '<span class="text-teal-800 font-medium">' +
                esc(b.id) +
                ' · ' +
                esc(b.subject) +
                '</span><span class="text-slate-500 shrink-0">' +
                esc(bookingStatusLabel(b.status)) +
                (b.hasTimeConflict ? ' · <span class="text-amber-700">冲突</span>' : '') +
                '</span></button></li>'
            )
            .join('') +
          '</ul>'
        : '<p class="text-sm text-slate-500">暂无预约</p>') +
      '</section></div>'
    );
  }

  function cardStat(title, value, color) {
    const bg = color === 'amber' ? 'bg-amber-50 text-amber-800' : color === 'blue' ? 'bg-blue-50 text-blue-800' : 'bg-teal-50 text-teal-800';
    return (
      '<div class="rounded-2xl border border-slate-200 p-4 ' +
      bg +
      '"><div class="text-xs font-medium opacity-80">' +
      esc(title) +
      '</div><div class="text-2xl font-semibold mt-1">' +
      value +
      '</div></div>'
    );
  }

  function renderAudit() {
    const filtered = state.mentors.filter((m) => state.auditFilter === 'all' || m.status === state.auditFilter);
    const sel = state.mentors.find((m) => m.id === state.selectedMentorId) || filtered[0] || null;
    if (sel && !state.selectedMentorId) state.selectedMentorId = sel.id;
    const listHtml = filtered
      .map((m) => {
        const active = sel && m.id === sel.id;
        return (
          '<button type="button" data-pick-mentor="' +
          esc(m.id) +
          '" class="w-full text-left px-3 py-2 rounded-xl border text-sm ' +
          (active ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50') +
          '">' +
          '<div class="font-bold flex flex-wrap items-center gap-1">' +
          esc(m.realName) +
          ' ' +
          mentorGradeBadge(m.evalGrade) +
          '</div><div class="text-xs text-slate-500">' +
          esc(STATUS_LABEL[m.status] || m.status) +
          ' · ' +
          esc(m.phone) +
          '</div></button>'
        );
      })
      .join('');
    let detail = '<p class="text-slate-500 text-sm">请选择左侧导师</p>';
    if (sel) {
      const proofList = (sel.proofFiles || [])
        .map((f) => {
          const href = proofFileHref(f);
          const name = (f && f.name) || '佐证材料';
          const meta = [f && f.tag, f && f.size, f && f.verified ? '已核验' : '']
            .filter(Boolean)
            .join(' · ');
          return (
            '<li class="border border-slate-100 rounded-lg px-3 py-2 text-sm">' +
            (href
              ? '<a href="' +
                esc(href) +
                '" target="_blank" rel="noopener noreferrer" class="text-teal-700 font-medium hover:underline">' +
                esc(name) +
                '</a>'
              : '<span class="font-medium">' + esc(name) + '</span>') +
            (meta ? '<div class="text-xs text-slate-500 mt-0.5">' + esc(meta) + '</div>' : '') +
            '</li>'
          );
        })
        .join('');
      const avail = (sel.availability || [])
        .map((a) => {
          const ranges = (a.ranges || []).map((r) => (r.start || '') + '-' + (r.end || '')).join('、');
          return '周' + a.weekday + ' ' + ranges;
        })
        .join('；');
      detail =
        '<div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1">' +
        '<h2 class="text-lg font-semibold">' +
        esc(sel.realName) +
        ' <span class="text-sm font-normal text-slate-500">' +
        esc(sel.code) +
        '</span></h2>' +
        '<div class="grid sm:grid-cols-2 gap-2 text-sm">' +
        row('手机', sel.phone) +
        row('身份证', sel.idCard) +
        row('院校', (sel.university || '') + (sel.province ? ' · ' + sel.province : '')) +
        row('学历', sel.degree) +
        row('学信网码', sel.chsiCode) +
        row('学信状态', sel.chsiStatus) +
        row('专业', sel.chsiMajor) +
        row('时薪', sel.hourlyRate != null ? '¥' + sel.hourlyRate : '—') +
        row('评级', sel.evalGrade) +
        row('状态', STATUS_LABEL[sel.status] || sel.status) +
        row('接单', sel.acceptingOrders === false ? '已暂停' : '正常') +
        row('提交时间', sel.submitTime) +
        row('偏好网点', sel.spacePreference) +
        row('银行卡', (sel.bankName || '') + ' ' + (sel.bankCardNumber || '')) +
        '</div>' +
        '<div class="text-sm"><span class="text-slate-500">授课学科：</span>' +
        esc((sel.subjects || []).concat(sel.customSubjects || []).join('、') || '—') +
        '</div>' +
        '<div class="text-sm"><span class="text-slate-500">教学亮点：</span>' +
        esc(sel.scoreHighlight || '—') +
        '</div>' +
        '<div class="text-sm"><span class="text-slate-500">可约时段：</span>' +
        esc(avail || '—') +
        '</div>' +
        '<div class="text-sm"><span class="text-slate-500">试讲视频 / 链接：</span> ' +
        externalLinkHtml(sel.lectureUrl, '打开试讲视频') +
        '</div>' +
        '<div><div class="text-xs font-bold text-slate-600 mb-2">资质附件</div>' +
        (proofList ? '<ul class="space-y-2">' + proofList + '</ul>' : '<p class="text-sm text-slate-400">暂无上传附件</p>') +
        '</div>' +
        '<div class="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<span class="text-sm font-bold text-slate-800">教研定级</span>' +
        '<a href="../docs/mentor-rating-rubric.md" target="_blank" rel="noopener" class="text-xs text-teal-700 font-medium hover:underline">查看内部量规</a>' +
        '</div>' +
        '<div><label class="text-xs text-slate-500">综合等级</label>' +
        '<select id="auditEvalGrade" class="w-full mt-1 border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">' +
        MENTOR_EVAL_GRADES
          .map((g) => {
            const on = (sel.evalGrade || '待教研评级') === g;
            return '<option value="' + esc(g) + '"' + (on ? ' selected' : '') + '>' + esc(g) + '</option>';
          })
          .join('') +
        '</select></div>' +
        renderRubricNotesFields(sel.evalRubricNotes) +
        '<button type="button" id="btnSaveMentorRating" class="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">保存教研评级</button>' +
        '</div>' +
        '<div><label class="text-xs text-slate-500">审核意见</label>' +
        '<textarea id="auditComment" rows="3" class="w-full mt-1 border border-slate-300 rounded-xl px-3 py-2 text-sm">' +
        esc(sel.reviewComment || '') +
        '</textarea></div>' +
        '<div class="flex flex-wrap gap-2">' +
        '<button type="button" data-audit="approved" class="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold">通过入库</button>' +
        '<button type="button" data-audit="supplement" class="px-4 py-2 rounded-xl bg-indigo-100 text-indigo-800 text-sm font-bold">待补材料</button>' +
        '<button type="button" data-audit="rejected" class="px-4 py-2 rounded-xl bg-rose-100 text-rose-800 text-sm font-bold">驳回</button>' +
        '<button type="button" data-toggle-accept="' +
        esc(sel.id) +
        '" class="px-4 py-2 rounded-xl border border-slate-300 text-sm">' +
        (sel.acceptingOrders === false ? '恢复接单' : '暂停接单') +
        '</button></div></div>';
    }
    const tabs = ['pending', 'approved', 'supplement', 'rejected', 'all']
      .map((st) => {
        const on = state.auditFilter === st;
        return (
          '<button type="button" data-audit-filter="' +
          st +
          '" class="text-xs px-3 py-1.5 rounded-lg ' +
          (on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600') +
          '">' +
          (st === 'all' ? '全部' : STATUS_LABEL[st] || st) +
          '</button>'
        );
      })
      .join('');
    return (
      '<div class="space-y-4"><h1 class="text-xl font-semibold">导师审核工作台</h1>' +
      '<div class="flex flex-wrap gap-2">' +
      tabs +
      '</div>' +
      '<div class="grid lg:grid-cols-3 gap-4">' +
      '<div class="space-y-2 max-h-[70vh] overflow-y-auto">' +
      listHtml +
      '</div>' +
      '<div class="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">' +
      detail +
      '</div></div></div>'
    );
  }

  function row(k, v) {
    return '<div><span class="text-slate-500">' + esc(k) + '：</span>' + esc(v) + '</div>';
  }

  function bookingStatusLabel(status) {
    if (!status) return '—';
    return BOOKING_STATUS_ZH[status] || status;
  }

  function findBookingById(id) {
    return state.bookings.find((b) => b.id === id) || null;
  }

  function resolveParentForBooking(b) {
    if (!b) return null;
    return (
      state.parents.find((p) => p.id === b.parentId) ||
      state.parents.find((p) => p.phone && b.parentPhone && p.phone === b.parentPhone) ||
      null
    );
  }

  function resolveMentorForBooking(b) {
    if (!b) return null;
    const mid = b.mentorId || b.tutorId;
    return state.mentors.find((m) => m.id === mid) || null;
  }

  function detailSection(title, innerHtml) {
    return (
      '<section class="border border-slate-200 rounded-xl p-4 space-y-2">' +
      '<h3 class="text-xs font-bold uppercase tracking-wide text-slate-500">' +
      esc(title) +
      '</h3>' +
      innerHtml +
      '</section>'
    );
  }

  function renderBookingSessionsTable(sessions) {
    const rows = (sessions || []).map((s) => {
      return (
        '<tr class="border-t border-slate-100">' +
        '<td class="py-2 pr-2 font-mono text-xs">' +
        esc(s.id || '—') +
        '</td><td class="py-2 pr-2">' +
        esc(s.date || s.sessionDate || '—') +
        '</td><td class="py-2 pr-2">' +
        esc(s.timeLabel || (s.timeStart && s.timeEnd ? s.timeStart + '-' + s.timeEnd : '—')) +
        '</td><td class="py-2 pr-2">' +
        esc(s.status || '—') +
        '</td><td class="py-2">' +
        esc(s.escrowStatus || '—') +
        '</td></tr>'
      );
    });
    if (!rows.length) {
      return '<p class="text-slate-500 text-xs">无课次记录</p>';
    }
    return (
      '<table class="w-full text-xs"><thead class="text-slate-500"><tr>' +
      '<th class="text-left pb-1">课次 ID</th><th class="text-left pb-1">日期</th><th class="text-left pb-1">时段</th><th class="text-left pb-1">状态</th><th class="text-left pb-1">托管</th></tr></thead><tbody>' +
      rows.join('') +
      '</tbody></table>'
    );
  }

  function renderBookingDetailHtml(b) {
    if (!b) return '<p class="text-slate-500">未找到预约</p>';
    const parent = resolveParentForBooking(b);
    const mentor = resolveMentorForBooking(b);
    const parentPhone = b.parentPhone || (parent && parent.phone) || '—';
    const parentName = b.parentName || (parent && parent.parentName) || '—';
    const studentNick = b.studentNickname || (parent && parent.studentNickname) || '—';
    const studentGrade = b.studentGrade || (parent && parent.studentGrade) || '—';
    const mentorPhone = (mentor && mentor.phone) || '—';
    const mentorName = b.tutorName || (mentor && mentor.realName) || '—';
    const orderBlock =
      '<div class="grid sm:grid-cols-2 gap-x-4 gap-y-1">' +
      row('预约 ID', b.id) +
      row('创建时间', b.createdAt || '—') +
      row('学科', b.subject) +
      row('类型', b.type || '—') +
      row('状态', bookingStatusLabel(b.status)) +
      row('课时', b.hours != null ? b.hours + ' 小时' : '—') +
      row('排期', b.schedule || b.timeSlot || '—') +
      row('教学点', b.space || '—') +
      row('仓位', b.boothLabel || '—') +
      row('金额', b.amount != null ? '¥' + b.amount : '—') +
      row('支付', b.paymentStatus || '—') +
      row('托管', b.escrowStatus || '—') +
      (b.hasTimeConflict
        ? '<div class="sm:col-span-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">' +
          esc(b.timeConflictNote || '存在时间冲突') +
          (b.timeConflictForced ? '（家长强制约课）' : '') +
          '</div>'
        : '') +
      (b.declineReason ? '<div class="sm:col-span-2">' + row('拒单原因', b.declineReason) + '</div>' : '') +
      '</div>';
    const studentBlock =
      '<div class="grid sm:grid-cols-2 gap-x-4 gap-y-1">' +
      row('学员昵称', studentNick) +
      row('年级', studentGrade) +
      row('家长姓名', parentName) +
      row('家长手机', parentPhone) +
      (parent && parent.id ? row('家长 ID', parent.id) : '') +
      '</div>';
    const mentorBlock =
      '<div class="grid sm:grid-cols-2 gap-x-4 gap-y-1">' +
      row('导师姓名', mentorName) +
      row('导师手机', mentorPhone) +
      row('导师 ID', b.mentorId || b.tutorId || '—') +
      (mentor ? row('院校', mentor.university || '—') + row('教研评级', mentor.evalGrade || '—') : '') +
      '</div>';
    return (
      '<div class="space-y-4">' +
      '<p class="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">管理员可见：含学员/导师联系方式，请勿外泄。</p>' +
      detailSection('订单信息', orderBlock) +
      detailSection('学员与家长', studentBlock) +
      detailSection('导师', mentorBlock) +
      detailSection('课次明细', renderBookingSessionsTable(b.sessions)) +
      '</div>'
    );
  }

  function openBookingDetail(bookingId) {
    state.bookingDetailId = bookingId;
    syncBookingDetailModal();
  }

  function closeBookingDetail() {
    state.bookingDetailId = null;
    syncBookingDetailModal();
  }

  function syncBookingDetailModal() {
    const modal = document.getElementById('bookingDetailModal');
    const body = document.getElementById('bookingDetailBody');
    if (!modal || !body) return;
    if (!state.bookingDetailId) {
      modal.classList.add('hidden');
      body.innerHTML = '';
      return;
    }
    const b = findBookingById(state.bookingDetailId);
    body.innerHTML = renderBookingDetailHtml(b);
    modal.classList.remove('hidden');
  }

  function bindBookingDetailModalHandlers() {
    const backdrop = document.getElementById('bookingDetailBackdrop');
    const closeBtn = document.getElementById('bookingDetailClose');
    if (backdrop && !backdrop._bound) {
      backdrop._bound = true;
      backdrop.addEventListener('click', () => closeBookingDetail());
    }
    if (closeBtn && !closeBtn._bound) {
      closeBtn._bound = true;
      closeBtn.addEventListener('click', () => closeBookingDetail());
    }
    if (!document._bookingDetailEscBound) {
      document._bookingDetailEscBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.bookingDetailId) closeBookingDetail();
      });
    }
  }

  function mentorGradeBadge(grade) {
    const g = grade || '待教研评级';
    const tone =
      g.indexOf('V3') >= 0
        ? 'bg-violet-100 text-violet-800'
        : g.indexOf('V2') >= 0
          ? 'bg-amber-100 text-amber-900'
          : g.indexOf('V1') >= 0
            ? 'bg-teal-100 text-teal-800'
            : g === '不予评级'
              ? 'bg-rose-100 text-rose-800'
              : 'bg-slate-100 text-slate-600';
    return '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ' + tone + '">' + esc(g) + '</span>';
  }

  function renderRubricNotesFields(notes) {
    const n = notes && typeof notes === 'object' ? notes : {};
    return RUBRIC_DIMENSIONS
      .map((d) => {
        return (
          '<div><label class="text-xs text-slate-500">' +
          esc(d.label) +
          '</label>' +
          '<textarea data-rubric-dim="' +
          esc(d.key) +
          '" rows="2" class="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-xs" placeholder="内部备注（对照 docs/mentor-rating-rubric.md）">' +
          esc(n[d.key] || '') +
          '</textarea></div>'
        );
      })
      .join('');
  }

  function captureParentDraft() {
    const phone = document.getElementById('addParentPhone');
    if (!phone) return;
    state.parentDraft = {
      phone: phone.value || '',
      parentName: (document.getElementById('addParentName') || {}).value || '',
      studentNickname: (document.getElementById('addParentStudent') || {}).value || '',
      studentGrade: (document.getElementById('addParentGrade') || {}).value || '',
      parentRole: (document.getElementById('addParentRole') || {}).value || '家长'
    };
  }

  function renderParentForm() {
    if (!state.parentFormOpen) return '';
    const d = state.parentDraft || {};
    const role = d.parentRole || '家长';
    const roles = ['家长', '妈妈', '爸爸', '其他'];
    return (
      '<form id="addParentForm" class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">' +
      '<div class="font-bold text-slate-800">添加家长</div>' +
      '<p class="text-xs text-slate-500">必填：手机号、家长姓名、学员昵称。不发送短信、不设置密码；家长之后用该手机号收取验证码登录。</p>' +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">手机号</span>' +
      '<input id="addParentPhone" required maxlength="11" value="' +
      esc(d.phone || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="11 位手机号"/></label>' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">家长姓名</span>' +
      '<input id="addParentName" required maxlength="32" value="' +
      esc(d.parentName || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="例：刘女士"/></label>' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">学员昵称</span>' +
      '<input id="addParentStudent" required maxlength="32" value="' +
      esc(d.studentNickname || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="例：乐乐同学"/></label>' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">学员年级（可选）</span>' +
      '<input id="addParentGrade" maxlength="40" value="' +
      esc(d.studentGrade || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="例：初三"/></label>' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">关系（可选）</span>' +
      '<select id="addParentRole" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2">' +
      roles
        .map((r) => '<option value="' + esc(r) + '"' + (r === role ? ' selected' : '') + '>' + esc(r) + '</option>')
        .join('') +
      '</select></label></div>' +
      '<div class="flex gap-2">' +
      '<button type="submit" class="text-sm bg-teal-600 text-white px-4 py-2 rounded-xl font-bold">确认添加</button>' +
      '<button type="button" id="btnCancelAddParent" class="text-sm px-4 py-2 rounded-xl border border-slate-200 font-bold">取消</button>' +
      '</div></form>'
    );
  }

  function renderParents() {
    captureParentDraft();
    const q = document.getElementById('parentSearch');
    const needle = (q && q.value) || '';
    const tag = state.subjectTagFilter;
    const rows = state.parents.filter((p) => {
      if (needle && String(p.phone || '').indexOf(needle) < 0 && String(p.parentName || '').indexOf(needle) < 0) {
        return false;
      }
      if (!tag) return true;
      const subs = (p.subjects || []).join(' ');
      return matchesSubjectTag(subs + ' ' + (p.studentGrade || ''), tag);
    });
    return (
      '<div class="space-y-4">' +
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '<h1 class="text-xl font-semibold">家长用户</h1>' +
      '<button type="button" id="btnOpenAddParent" class="text-sm bg-teal-600 text-white px-4 py-2 rounded-xl font-bold">添加家长</button>' +
      '</div>' +
      renderParentForm() +
      subjectFilterBarHtml() +
      '<input id="parentSearch" placeholder="手机号 / 姓名" class="border border-slate-300 rounded-xl px-3 py-2 text-sm w-full max-w-xs" value="' +
      esc(needle) +
      '"/>' +
      '<div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">' +
      '<table class="admin-dense w-full text-sm"><thead class="bg-slate-50 text-slate-500"><tr><th class="text-left p-3">姓名</th><th class="text-left p-3">手机</th><th class="text-left p-3">学员</th><th class="text-left p-3">目标学科</th><th class="text-left p-3">操作</th></tr></thead><tbody>' +
      (rows.length
        ? rows
            .map(
              (p) =>
                '<tr class="border-t border-slate-100"><td class="p-3">' +
                esc(p.parentName) +
                '</td><td class="p-3 font-mono">' +
                esc(p.phone) +
                '</td><td class="p-3">' +
                esc(p.studentNickname) +
                ' / ' +
                esc(p.studentGrade) +
                '</td><td class="p-3 text-xs text-slate-600">' +
                esc((p.subjects || []).join('、') || '—') +
                '</td><td class="p-3"><button type="button" data-delete-parent="' +
                esc(p.id) +
                '" data-delete-label="' +
                esc((p.parentName || '该家长') + ' ' + (p.phone || '')) +
                '" class="text-rose-700 text-xs font-bold">删除</button></td></tr>'
            )
            .join('')
        : '<tr><td colspan="5" class="p-6 text-center text-slate-500">暂无家长</td></tr>') +
      '</tbody></table></div></div>'
    );
  }

  function captureMentorDraft() {
    const phone = document.getElementById('addMentorPhone');
    if (!phone) return;
    state.mentorDraft = {
      phone: phone.value || '',
      realName: (document.getElementById('addMentorName') || {}).value || '',
      university: (document.getElementById('addMentorUniversity') || {}).value || '',
      hourlyRate: (document.getElementById('addMentorRate') || {}).value || ''
    };
  }

  function renderMentorForm() {
    if (!state.mentorFormOpen) return '';
    const d = state.mentorDraft || {};
    return (
      '<form id="addMentorForm" class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">' +
      '<div class="font-bold text-slate-800">添加导师</div>' +
      '<p class="text-xs text-slate-500">必填：手机号、真实姓名。新建后为待审核，不发送短信、不设置密码；导师用该手机号验证码登录后可补全资料。</p>' +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">手机号</span>' +
      '<input id="addMentorPhone" required maxlength="11" value="' +
      esc(d.phone || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="11 位手机号"/></label>' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">真实姓名</span>' +
      '<input id="addMentorName" required maxlength="32" value="' +
      esc(d.realName || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="例：李老师"/></label>' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">院校（可选）</span>' +
      '<input id="addMentorUniversity" maxlength="40" value="' +
      esc(d.university || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2"/></label>' +
      '<label class="text-sm block"><span class="text-xs text-slate-500">期望时薪（可选）</span>' +
      '<input id="addMentorRate" inputmode="numeric" value="' +
      esc(d.hourlyRate || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="元/小时"/></label></div>' +
      '<div class="flex gap-2">' +
      '<button type="submit" class="text-sm bg-teal-600 text-white px-4 py-2 rounded-xl font-bold">确认添加</button>' +
      '<button type="button" id="btnCancelAddMentor" class="text-sm px-4 py-2 rounded-xl border border-slate-200 font-bold">取消</button>' +
      '</div></form>'
    );
  }

  function renderMentorsList() {
    captureMentorDraft();
    const rows = state.mentors.filter((m) => {
      const tag = state.subjectTagFilter;
      if (!tag) return true;
      const subs = (m.subjects || []).concat(m.customSubjects || []).join(' ');
      return matchesSubjectTag(subs, tag);
    });
    return (
      '<div class="space-y-4">' +
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '<h1 class="text-xl font-semibold">导师用户</h1>' +
      '<button type="button" id="btnOpenAddMentor" class="text-sm bg-teal-600 text-white px-4 py-2 rounded-xl font-bold">添加导师</button>' +
      '</div>' +
      renderMentorForm() +
      subjectFilterBarHtml() +
      '<div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">' +
      '<table class="admin-dense w-full text-sm"><thead class="bg-slate-50 text-slate-500"><tr><th class="text-left p-3">姓名</th><th class="text-left p-3">手机</th><th class="text-left p-3">学科</th><th class="text-left p-3">评级</th><th class="text-left p-3">状态</th><th class="text-left p-3">接单</th><th class="text-left p-3">操作</th></tr></thead><tbody>' +
      (rows.length
        ? rows
            .map((m) => {
              return (
                '<tr class="border-t border-slate-100"><td class="p-3 font-medium">' +
                esc(m.realName) +
                '</td><td class="p-3 font-mono">' +
                esc(m.phone) +
                '</td><td class="p-3 text-xs max-w-[200px] truncate" title="' +
                esc((m.subjects || []).join('、')) +
                '">' +
                esc((m.subjects || []).slice(0, 3).join('、') || '—') +
                '</td><td class="p-3">' +
                esc(m.evalGrade || '待教研评级') +
                '</td><td class="p-3">' +
                esc(STATUS_LABEL[m.status] || m.status) +
                '</td><td class="p-3">' +
                (m.acceptingOrders === false ? '暂停' : '正常') +
                '</td><td class="p-3 whitespace-nowrap"><button type="button" data-toggle-accept="' +
                esc(m.id) +
                '" class="text-teal-700 text-xs font-bold">切换接单</button>' +
                '<button type="button" data-delete-mentor="' +
                esc(m.id) +
                '" data-delete-label="' +
                esc((m.realName || '该导师') + ' ' + (m.phone || '')) +
                '" class="text-rose-700 text-xs font-bold ml-3">删除</button></td></tr>'
              );
            })
            .join('')
        : '<tr><td colspan="7" class="p-6 text-center text-slate-500">暂无导师</td></tr>') +
      '</tbody></table></div></div>'
    );
  }

  function renderBookings() {
    const filters = [
      { id: 'all', label: '全部预约' },
      { id: 'conflict', label: '仅时间冲突/强制约课' }
    ]
      .map((f) => {
        const on = state.bookingListFilter === f.id;
        return (
          '<button type="button" data-booking-filter="' +
          f.id +
          '" class="text-xs px-3 py-1.5 rounded-lg ' +
          (on ? 'bg-amber-600 text-white' : 'bg-slate-100') +
          '">' +
          f.label +
          '</button>'
        );
      })
      .join('');
    const list = state.bookings.filter((b) => {
      if (state.bookingListFilter === 'conflict') return !!b.hasTimeConflict;
      if (state.subjectTagFilter) return matchesSubjectTag(b.subject, state.subjectTagFilter);
      return true;
    });
    return (
      '<div class="space-y-4"><div class="flex flex-wrap items-center justify-between gap-3">' +
      '<h1 class="text-xl font-semibold">预约订单</h1>' +
      '<button type="button" id="btnProcessEscrow" class="text-sm bg-slate-900 text-white px-4 py-2 rounded-xl font-bold">执行托管释放扫描</button></div>' +
      subjectFilterBarHtml() +
      '<div class="flex flex-wrap gap-2">' +
      filters +
      '</div>' +
      '<div class="bg-white border border-slate-200 rounded-2xl overflow-x-auto">' +
      '<table class="admin-dense w-full text-sm min-w-[960px]"><thead class="bg-slate-50 text-slate-500"><tr>' +
      '<th class="text-left p-3">ID</th><th class="text-left p-3">学科</th><th class="text-left p-3">导师</th><th class="text-left p-3">教学点/仓位</th><th class="text-left p-3">冲突</th><th class="text-left p-3">状态</th><th class="text-left p-3">支付</th><th class="text-left p-3">托管</th></tr></thead><tbody>' +
      (list.length
        ? list
            .map(
              (b) =>
                '<tr class="border-t border-slate-100 cursor-pointer hover:bg-slate-50' +
                (b.hasTimeConflict ? ' bg-amber-50/40' : '') +
                '" data-open-booking="' +
                esc(b.id) +
                '" role="button" tabindex="0"><td class="p-3 font-mono text-xs text-teal-800 font-medium">' +
                esc(b.id) +
                '</td><td class="p-3">' +
                esc(b.subject) +
                '</td><td class="p-3">' +
                esc(b.tutorName) +
                '</td><td class="p-3 text-xs">' +
                esc(b.space || '—') +
                (b.boothLabel ? '<br><span class="text-slate-500">' + esc(b.boothLabel) + '</span>' : '') +
                '</td><td class="p-3">' +
                (b.hasTimeConflict
                  ? bookingConflictBadge(b) +
                    '<div class="text-xs text-amber-800 mt-1 max-w-[180px]">' +
                    esc(b.timeConflictNote || '') +
                    '</div>'
                  : '—') +
                '</td><td class="p-3">' +
                esc(bookingStatusLabel(b.status)) +
                '</td><td class="p-3">' +
                esc(b.paymentStatus || '—') +
                '</td><td class="p-3">' +
                esc(b.escrowStatus || '—') +
                '</td></tr>'
            )
            .join('')
        : '<tr><td colspan="8" class="p-6 text-center text-slate-500">暂无符合条件的预约</td></tr>') +
      '</tbody></table></div></div>'
    );
  }

  function captureTeachingPointDraft() {
    const input = document.getElementById('addTeachingPointName');
    if (!input) return;
    state.teachingPointDraftName = input.value || '';
  }

  function renderTeachingPointForm() {
    if (!state.teachingPointFormOpen) return '';
    return (
      '<form id="addTeachingPointForm" class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">' +
      '<div class="font-bold text-slate-800">添加教学点</div>' +
      '<p class="text-xs text-slate-500">只需填写名称。保存后按当前规则自动生成 3 个编号仓位。</p>' +
      '<label class="text-sm block max-w-md"><span class="text-xs text-slate-500">教学点名称</span>' +
      '<input id="addTeachingPointName" required maxlength="40" value="' +
      esc(state.teachingPointDraftName || '') +
      '" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="例：锦江春熙微网点"/></label>' +
      '<div class="flex gap-2">' +
      '<button type="submit" class="text-sm bg-teal-600 text-white px-4 py-2 rounded-xl font-bold">确认添加</button>' +
      '<button type="button" id="btnCancelAddTeachingPoint" class="text-sm px-4 py-2 rounded-xl border border-slate-200 font-bold">取消</button>' +
      '</div></form>'
    );
  }

  function renderTeachingPoints() {
    captureTeachingPointDraft();
    let tps = state.teachingPoints || [];
    if (!tps.length && !state.teachingPointsLoaded && window.StorageService && StorageService.SPACE_OPTIONS) {
      tps = StorageService.SPACE_OPTIONS.map((name, idx) => ({
        id: 'TP-LOCAL-' + idx,
        name: name,
        boothCount: 3,
        booths: []
      }));
    }
    const selId = state.tpOccupancyTpId || (tps[0] && tps[0].id) || '';
    const occ = state.tpOccupancy;
    let occHtml =
      '<p class="text-sm text-slate-500">选择教学点与日期后点击「查询占用」</p>';
    if (occ && occ.booths) {
      occHtml =
        '<div class="text-xs text-slate-500 mb-2">日期：' +
        esc(occ.date || state.tpOccupancyDate) +
        ' · ' +
        esc(occ.teachingPointName) +
        '</div>' +
        '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">' +
        occ.booths
          .map((b) => {
            const items = (b.bookings || [])
              .map(
                (x) =>
                  '<li class="border-t border-slate-100 pt-1 mt-1">' +
                  esc(x.timeLabel || x.timeStart + '-' + x.timeEnd) +
                  ' · ' +
                  esc(x.tutorName) +
                  ' · ' +
                  esc(x.subject) +
                  (x.hasTimeConflict ? ' <span class="text-amber-700">冲突</span>' : '') +
                  '<div class="font-mono text-xs text-slate-500">' +
                  esc(x.bookingId) +
                  '</div></li>'
              )
              .join('');
            return (
              '<div class="border border-slate-200 rounded-xl p-3 bg-slate-50/50">' +
              '<div class="font-bold text-slate-800">' +
              esc(b.label) +
              '</div>' +
              (items ? '<ul class="text-xs mt-2">' + items + '</ul>' : '<p class="text-xs text-emerald-700 mt-2">空闲</p>') +
              '</div>'
            );
          })
          .join('') +
        '</div>';
      if (occ.unassigned && occ.unassigned.length) {
        occHtml +=
          '<div class="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3">未分配仓位预约：' +
          occ.unassigned.length +
          ' 笔（请协助家长选仓或改期）</div>';
      }
    }
    return (
      '<div class="space-y-6">' +
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '<h1 class="text-xl font-semibold">教学点仓位管理</h1>' +
      '<button type="button" id="btnOpenAddTeachingPoint" class="text-sm bg-teal-600 text-white px-4 py-2 rounded-xl font-bold">添加教学点</button>' +
      '</div>' +
      '<p class="text-sm text-slate-500">默认每网点 3 个编号仓位；缩减仓位前须确保无有效预约占用将被移除的仓位。删除教学点时，若仍有进行中的预约或占用仓位会被拒绝。智能仓 IoT 功能保持关闭。</p>' +
      renderTeachingPointForm() +
      '<div class="space-y-4">' +
      tps
        .map((tp) => {
          const count = (tp.booths && tp.booths.length) || tp.boothCount || 3;
          const boothTags = (tp.booths || [])
            .map((b) => '<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">' + esc(b.label) + '</span>')
            .join(' ');
          return (
            '<div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">' +
            '<div class="flex flex-wrap items-start justify-between gap-2">' +
            '<div><div class="font-bold text-slate-900">' +
            esc(tp.name) +
            '</div><div class="text-xs text-slate-500 font-mono">' +
            esc(tp.id) +
            '</div></div>' +
            '<div class="flex items-center gap-2 text-sm">' +
            '<label class="text-slate-600">仓位数</label>' +
            '<input type="number" min="1" max="24" value="' +
            count +
            '" data-tp-count="' +
            esc(tp.id) +
            '" class="w-16 border border-slate-300 rounded-lg px-2 py-1 text-center"/>' +
            '<button type="button" data-tp-save="' +
            esc(tp.id) +
            '" class="text-xs font-bold bg-teal-600 text-white px-3 py-1.5 rounded-lg">保存</button>' +
            '<button type="button" data-tp-delete="' +
            esc(tp.id) +
            '" data-tp-name="' +
            esc(tp.name) +
            '" class="text-xs font-bold text-rose-700 px-2 py-1.5">删除</button>' +
            '</div></div>' +
            '<div class="flex flex-wrap gap-1">' +
            boothTags +
            '</div></div>'
          );
        })
        .join('') +
      (tps.length ? '' : '<p class="text-sm text-slate-500">还没有教学点。点击「添加教学点」新建，系统会生成 3 个编号仓位。</p>') +
      '</div>' +
      '<section class="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">' +
      '<h2 class="font-bold text-slate-800">仓位占用一览</h2>' +
      '<div class="flex flex-wrap gap-2 items-end text-sm">' +
      '<div><label class="block text-xs text-slate-500 mb-1">教学点</label><select id="tpOccSelect" class="border border-slate-300 rounded-xl px-3 py-2">' +
      tps
        .map(
          (tp) =>
            '<option value="' +
            esc(tp.id) +
            '" ' +
            (tp.id === selId ? 'selected' : '') +
            '>' +
            esc(tp.name) +
            '</option>'
        )
        .join('') +
      '</select></div>' +
      '<div><label class="block text-xs text-slate-500 mb-1">日期</label><input type="date" id="tpOccDate" value="' +
      esc(state.tpOccupancyDate || todayIso()) +
      '" class="border border-slate-300 rounded-xl px-3 py-2"/></div>' +
      '<button type="button" id="btnTpOccupancy" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold">查询占用</button>' +
      '</div>' +
      '<div id="tpOccWrap">' +
      occHtml +
      '</div></section>' +
      '<section class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600">' +
      '<div class="font-bold text-slate-800 mb-1">学科目录（API）</div>' +
      (state.subjectCatalog
        ? '<div>学段：' +
          esc((state.subjectCatalog.topLevelGradeBands || []).join('、')) +
          '</div><div class="mt-1">测评学科：' +
          esc((state.subjectCatalog.assessmentSubjects || []).join('、')) +
          '</div>'
        : '加载失败') +
      '</section></div>'
    );
  }

  function renderContracts() {
    return (
      '<div class="space-y-4"><h1 class="text-xl font-semibold">合约</h1>' +
      '<div class="bg-white border border-slate-200 rounded-2xl p-4 text-sm space-y-2">' +
      (state.contracts.length
        ? state.contracts
            .map(
              (c) =>
                '<div class="border-b border-slate-100 pb-2">' +
                esc(c.title || c.id) +
                ' · 预约 ' +
                esc(c.bookingId) +
                ' · ' +
                esc(c.signedAt) +
                '</div>'
            )
            .join('')
        : '<p class="text-slate-500">暂无合约</p>') +
      '</div></div>'
    );
  }

  function renderAssessmentDetailPanel() {
    const d = state.assessmentDetail;
    if (!d) {
      return '<p class="text-sm text-slate-500">选择左侧记录查看试卷与作答明细</p>';
    }
    const answers = Array.isArray(d.answers) ? d.answers : [];
    let body = '';
    if (answers.length) {
      body =
        '<ol class="space-y-3 list-decimal list-inside text-sm">' +
        answers
          .map((item, i) => {
            const ok = item.correct === true;
            return (
              '<li class="border border-slate-100 rounded-xl p-3 bg-slate-50/40">' +
              '<div class="font-medium text-slate-800">' +
              esc(item.question || '题目 ' + (i + 1)) +
              '</div>' +
              '<div class="text-xs mt-1 ' +
              (ok ? 'text-emerald-700' : 'text-rose-700') +
              '">学员答案：' +
              esc(item.selectedText || item.selectedIndex) +
              ' · 正确答案：' +
              esc(item.correctText || item.correctIndex) +
              '</div></li>'
            );
          })
          .join('') +
        '</ol>';
    } else if (Array.isArray(d.questions) && d.questions.length) {
      body =
        '<ol class="space-y-2 list-decimal list-inside text-sm">' +
        d.questions
          .map(
            (q, i) =>
              '<li><span class="font-medium">' +
              esc(q.q || q.question || '题' + (i + 1)) +
              '</span> <span class="text-xs text-slate-500">参考答案：' +
              esc(
                q.options && q.a != null && q.options[q.a] != null ? q.options[q.a] : (q.correctText || '—')
              ) +
              '</span></li>'
          )
          .join('') +
        '</ol>';
    } else {
      body =
        '<p class="text-sm text-slate-500">该记录未保存逐题明细（得分 ' +
        esc(d.score) +
        ' / ' +
        esc(d.level || '') +
        '）。新提交的测评将包含完整试卷与答案。</p>';
    }
    return (
      '<div class="space-y-3">' +
      '<h2 class="text-base font-bold text-slate-900">' +
      esc(d.subject) +
      ' · ' +
      esc(d.score) +
      '分 · ' +
      esc(d.level || '') +
      '</h2>' +
      '<div class="text-xs text-slate-500">' +
      esc(d.studentNickname || d.studentName || '学员') +
      ' · ' +
      esc(d.studentGrade || d.gradeBand || '') +
      ' · ' +
      esc(d.completedAt || d.createdAt || '') +
      '</div>' +
      body +
      '</div>'
    );
  }

  function renderAssessments() {
    const rows = state.assessments.slice().sort((a, b) =>
      String(b.completedAt || b.createdAt || '').localeCompare(String(a.completedAt || a.createdAt || ''))
    );
    const listHtml = rows.length
      ? rows
          .map((a) => {
            const active = state.selectedAssessmentId === a.id;
            const student = a.studentNickname || a.studentName || a.parentPhone || '—';
            return (
              '<button type="button" data-pick-assessment="' +
              esc(a.id) +
              '" class="w-full text-left px-3 py-2 rounded-xl border text-sm ' +
              (active ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50') +
              '">' +
              '<div class="font-bold">' +
              esc(a.subject) +
              ' · ' +
              esc(a.score) +
              '分</div>' +
              '<div class="text-xs text-slate-500">' +
              esc(student) +
              ' · ' +
              esc(a.completedAt || a.createdAt || '') +
              '</div></button>'
            );
          })
          .join('')
      : '<p class="text-slate-500 text-sm">暂无测评记录</p>';
    return (
      '<div class="space-y-4"><h1 class="text-xl font-semibold">学情测评</h1>' +
      '<div class="grid lg:grid-cols-3 gap-4">' +
      '<div class="space-y-2 max-h-[70vh] overflow-y-auto">' +
      listHtml +
      '</div>' +
      '<div class="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5" id="assessmentDetailWrap">' +
      renderAssessmentDetailPanel() +
      '</div></div></div>'
    );
  }

  function payFiltersFormHtml() {
    const f = state.payFilters;
    return (
      '<div class="bg-white border border-slate-200 rounded-2xl p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">' +
      '<div><label class="text-xs text-slate-500">开始时间</label><input type="datetime-local" id="payFilterFrom" value="' +
      esc(f.from) +
      '" class="w-full mt-1 border border-slate-300 rounded-xl px-2 py-1.5"/></div>' +
      '<div><label class="text-xs text-slate-500">结束时间</label><input type="datetime-local" id="payFilterTo" value="' +
      esc(f.to) +
      '" class="w-full mt-1 border border-slate-300 rounded-xl px-2 py-1.5"/></div>' +
      '<div><label class="text-xs text-slate-500">导师名</label><input id="payFilterMentor" value="' +
      esc(f.mentorName) +
      '" class="w-full mt-1 border border-slate-300 rounded-xl px-2 py-1.5"/></div>' +
      '<div><label class="text-xs text-slate-500">学生名</label><input id="payFilterStudent" value="' +
      esc(f.studentName) +
      '" class="w-full mt-1 border border-slate-300 rounded-xl px-2 py-1.5"/></div>' +
      '<div><label class="text-xs text-slate-500">家长手机</label><input id="payFilterPhone" value="' +
      esc(f.phone) +
      '" class="w-full mt-1 border border-slate-300 rounded-xl px-2 py-1.5"/></div>' +
      '<div><label class="text-xs text-slate-500">商户单号</label><input id="payFilterOut" value="' +
      esc(f.outTradeNo) +
      '" class="w-full mt-1 border border-slate-300 rounded-xl px-2 py-1.5"/></div>' +
      '<div><label class="text-xs text-slate-500">状态</label><select id="payFilterStatus" class="w-full mt-1 border border-slate-300 rounded-xl px-2 py-1.5">' +
      ['', 'SUCCESS', 'REFUND', 'REFUNDED', 'refund_pending', 'refund_failed', 'NOTPAY']
        .map((st) => '<option value="' + esc(st) + '" ' + (f.status === st ? 'selected' : '') + '>' + (st || '全部') + '</option>')
        .join('') +
      '</select></div>' +
      '<div class="flex items-end gap-2 sm:col-span-2">' +
      '<button type="button" id="btnPaySearch" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold">查询</button>' +
      '<button type="button" id="btnPayExport" class="border border-slate-300 px-4 py-2 rounded-xl text-sm font-bold">导出 Excel</button>' +
      '</div></div>'
    );
  }

  function renderPayments() {
    return (
      '<div class="space-y-4"><div class="flex flex-wrap items-center justify-between gap-3">' +
      '<h1 class="text-xl font-semibold">支付订单</h1>' +
      '<button type="button" id="btnReloadPay" class="text-sm border border-slate-300 px-3 py-2 rounded-xl">刷新</button></div>' +
      payFiltersFormHtml() +
      '<div id="payTableWrap" class="text-sm text-slate-500">加载中…</div></div>'
    );
  }

  function readPayFiltersFromDom() {
    const fromEl = document.getElementById('payFilterFrom');
    const toEl = document.getElementById('payFilterTo');
    state.payFilters.from = (fromEl && fromEl.value) || '';
    state.payFilters.to = (toEl && toEl.value) || '';
    state.payFilters.mentorName = ((document.getElementById('payFilterMentor') || {}).value || '').trim();
    state.payFilters.studentName = ((document.getElementById('payFilterStudent') || {}).value || '').trim();
    state.payFilters.phone = ((document.getElementById('payFilterPhone') || {}).value || '').trim();
    state.payFilters.outTradeNo = ((document.getElementById('payFilterOut') || {}).value || '').trim();
    state.payFilters.status = ((document.getElementById('payFilterStatus') || {}).value || '').trim();
  }

  function payOrdersQueryFromState() {
    const q = { limit: state.payFilters.limit || 200 };
    if (state.payFilters.from) q.from = state.payFilters.from;
    if (state.payFilters.to) q.to = state.payFilters.to;
    if (state.payFilters.mentorName) q.mentorName = state.payFilters.mentorName;
    if (state.payFilters.studentName) q.studentName = state.payFilters.studentName;
    if (state.payFilters.phone) q.phone = state.payFilters.phone;
    if (state.payFilters.outTradeNo) q.outTradeNo = state.payFilters.outTradeNo;
    if (state.payFilters.status) q.status = state.payFilters.status;
    return q;
  }

  function renderPayOrdersTable() {
    const wrap = document.getElementById('payTableWrap');
    if (!wrap) return;
    if (!state.payOrders.length) {
      wrap.innerHTML = '<p class="text-slate-500">暂无支付订单</p>';
      return;
    }
    wrap.innerHTML =
      '<div class="bg-white border border-slate-200 rounded-2xl overflow-x-auto"><table class="admin-dense w-full min-w-[960px]"><thead class="bg-slate-50 text-slate-500"><tr>' +
      '<th class="text-left p-3">商户单号</th><th class="text-left p-3">预约</th><th class="text-left p-3">导师</th><th class="text-left p-3">学生</th><th class="text-left p-3">手机</th><th class="text-left p-3">金额(分)</th><th class="text-left p-3">状态</th><th class="text-left p-3">时间</th><th></th></tr></thead><tbody>' +
      state.payOrders
        .map((o) => {
          const canRefund = o.status === 'SUCCESS';
          return (
            '<tr class="border-t border-slate-100"><td class="p-3 font-mono text-xs">' +
            esc(o.outTradeNo) +
            '</td><td class="p-3">' +
            esc(o.bookingId) +
            '</td><td class="p-3">' +
            esc(o.mentorName || '—') +
            '</td><td class="p-3">' +
            esc(o.studentName || '—') +
            '</td><td class="p-3 font-mono text-xs">' +
            esc(o.parentPhone || '—') +
            '</td><td class="p-3">' +
            esc(o.amount) +
            '</td><td class="p-3">' +
            esc(o.status) +
            '</td><td class="p-3 text-xs">' +
            esc(o.successTime || o.createTime || '') +
            '</td><td class="p-3">' +
            (canRefund
              ? '<button type="button" data-refund="' + esc(o.outTradeNo) + '" class="text-rose-700 font-bold text-xs">退款</button>'
              : '—') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
  }

  function exportPayOrdersXlsx() {
    if (!window.XLSX) {
      toast('Excel 组件未加载', 'error');
      return;
    }
    if (!state.payOrders.length) {
      toast('没有可导出的订单', 'warn');
      return;
    }
    const rows = state.payOrders.map((o) => ({
      商户单号: o.outTradeNo || '',
      预约编号: o.bookingId || '',
      导师: o.mentorName || '',
      学生: o.studentName || '',
      家长手机: o.parentPhone || '',
      金额分: o.amount != null ? o.amount : '',
      状态: o.status || '',
      支付时间: o.successTime || o.createTime || '',
      退款时间: o.refundTime || ''
    }));
    const sheet = window.XLSX.utils.json_to_sheet(rows);
    const book = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(book, sheet, '支付订单');
    const stamp = todayIso().replace(/-/g, '');
    window.XLSX.writeFile(book, '支付订单_' + stamp + '.xlsx');
    toast('已导出 Excel');
  }

  async function loadPayOrders() {
    const wrap = document.getElementById('payTableWrap');
    if (!wrap) return;
    readPayFiltersFromDom();
    wrap.textContent = '加载中…';
    try {
      const res = await AdminApi.listPayOrders(payOrdersQueryFromState());
      state.payOrders = res.orders || [];
      renderPayOrdersTable();
    } catch (e) {
      wrap.innerHTML = '<p class="text-rose-600">加载失败：' + esc(e.message) + '</p>';
    }
  }

  async function openAssessmentDetail(id) {
    state.selectedAssessmentId = id;
    const local = state.assessments.find((a) => a.id === id) || null;
    state.assessmentDetail = local;
    const wrap = document.getElementById('assessmentDetailWrap');
    if (wrap) wrap.innerHTML = renderAssessmentDetailPanel();
    try {
      const remote = await AdminApi.getAssessment(id);
      if (remote && remote.id) {
        state.assessmentDetail = remote;
        if (wrap) wrap.innerHTML = renderAssessmentDetailPanel();
      }
    } catch (e) {
      if (!local && wrap) {
        wrap.innerHTML = '<p class="text-rose-600 text-sm">加载失败：' + esc(e.message) + '</p>';
      }
    }
  }

  function renderFeedback() {
    const filtered =
      state.feedbackFilter === 'all'
        ? state.feedback
        : state.feedback.filter((t) => t.status === state.feedbackFilter);
    const filters = ['all', '待处理', '处理中', '已解决', '已驳回']
      .map((f) => {
        const on = state.feedbackFilter === f;
        return (
          '<button type="button" data-fb-filter="' +
          esc(f) +
          '" class="text-xs px-3 py-1.5 rounded-lg ' +
          (on ? 'bg-slate-900 text-white' : 'bg-slate-100') +
          '">' +
          (f === 'all' ? '全部' : f) +
          '</button>'
        );
      })
      .join('');
    return (
      '<div class="space-y-4"><h1 class="text-xl font-semibold">反馈与投诉</h1><div class="flex flex-wrap gap-2">' +
      filters +
      '</div><div class="space-y-3">' +
      (filtered.length
        ? filtered
            .map((t) => {
              return (
                '<div class="bg-white border border-slate-200 rounded-2xl p-4">' +
                '<div class="font-bold">' +
                esc(t.title) +
                ' <span class="text-xs text-slate-500">' +
                esc(t.status) +
                '</span></div>' +
                '<div class="text-xs text-slate-500 mt-1">' +
                esc(t.type) +
                ' · ' +
                esc(t.mentorName || '') +
                ' · ' +
                esc(t.createdAt) +
                '</div>' +
                '<p class="text-sm mt-2">' +
                esc(t.detail) +
                '</p>' +
                (t.adminReply && String(t.adminReply).trim()
                  ? '<div class="mt-2 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-emerald-900"><span class="font-semibold">官方回复：</span>' +
                    esc(t.adminReply) +
                    (t.repliedAt ? ' <span class="text-emerald-700/70">(' + esc(t.repliedAt) + ')</span>' : '') +
                    '</div>'
                  : '') +
                (t.handlerNote && String(t.handlerNote).trim()
                  ? '<div class="mt-2 text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-blue-900"><span class="font-semibold">备注：</span>' +
                    esc(t.handlerNote) +
                    '</div>'
                  : '') +
                '<div class="flex flex-wrap gap-2 mt-3">' +
                ['处理中', '已解决', '已驳回']
                  .map(
                    (st) =>
                      '<button type="button" data-fb-status="' +
                      esc(st) +
                      '" data-fb-id="' +
                      esc(t.id) +
                      '" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200">' +
                      st +
                      '</button>'
                  )
                  .join('') +
                '<button type="button" data-fb-reply="' +
                esc(t.id) +
                '" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white">回复</button>' +
                '<button type="button" data-fb-note="' +
                esc(t.id) +
                '" class="text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white">备注</button></div></div>'
              );
            })
            .join('')
        : '<p class="text-slate-400">暂无反馈</p>') +
      '</div></div>'
    );
  }

  function renderPermissions() {
    const catalog = state.adminRbac.catalog || [];
    const byGroup = {};
    catalog.forEach((item) => {
      const g = item.group || '其他';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(item);
    });
    const staffRows = (state.rbacStaff || [])
      .map((row) => {
        const draft = state.rbacDraft[row.phone] || row.modules || [];
        const primaryRowEarly = !!(row.isPrimaryAdmin || row.isSuperAdmin);
        const disabled = primaryRowEarly ? 'disabled' : '';
        const checks = catalog
          .map((mod) => {
            const on = draft.indexOf(mod.key) >= 0 || primaryRowEarly;
            return (
              '<label class="inline-flex items-center gap-1 text-xs mr-3 mb-1" title="' +
              esc(mod.label) +
              '">' +
              '<input type="checkbox" data-rbac-phone="' +
              esc(row.phone) +
              '" data-rbac-mod="' +
              esc(mod.key) +
              '" ' +
              (on ? 'checked' : '') +
              ' ' +
              disabled +
              ' class="rounded"/>' +
              '<span>' +
              esc(mod.label) +
              '</span></label>'
            );
          })
          .join('');
        const primaryRow = !!(row.isPrimaryAdmin || row.isSuperAdmin);
        let actions = '不可修改';
        if (!primaryRow) {
          actions =
            '<button type="button" data-rbac-save="' +
            esc(row.phone) +
            '" class="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold">保存</button>';
          if (isPrimaryAdminUser()) {
            actions +=
              '<button type="button" data-rbac-remove="' +
              esc(row.phone) +
              '" class="ml-2 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold">移除</button>';
          }
        }
        return (
          '<tr class="border-b border-slate-100 align-top">' +
          '<td class="py-3 pr-4 font-mono text-sm">' +
          esc(row.phone) +
          (primaryRow ? '<div class="text-xs text-amber-700 font-bold mt-1">主管理员</div>' : '') +
          '</td><td class="py-3">' +
          checks +
          '</td><td class="py-3 text-xs text-slate-500 whitespace-nowrap">' +
          actions +
          '</td></tr>'
        );
      })
      .join('');
    const addAdminForm = isPrimaryAdminUser()
      ? '<form id="addAdminForm" class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end gap-3">' +
        '<label class="text-sm block"><span class="text-xs text-slate-500">管理员手机号</span>' +
        '<input id="addAdminPhone" required maxlength="11" class="mt-1 border border-slate-300 rounded-xl px-3 py-2" placeholder="11 位手机号"/></label>' +
        '<button type="submit" class="text-sm bg-teal-600 text-white px-4 py-2 rounded-xl font-bold">添加管理员</button>' +
        '<p class="text-xs text-slate-500 w-full">新管理员默认可登录，但没有任何模块权限，需在下表勾选后保存。不发送短信、不设置密码。</p></form>'
      : '<p class="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">添加或移除管理员仅主管理员可操作。</p>';
    return (
      '<div class="space-y-4">' +
      '<h1 class="text-xl font-semibold text-slate-900">权限设置</h1>' +
      '<p class="text-sm text-slate-600">为其他管理员勾选可访问的运营模块。手机号 <span class="font-mono">13540012341</span> 是主管理员，始终拥有全部模块，不能被移除，也不能被改权限。</p>' +
      addAdminForm +
      '<div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">' +
      '<table class="admin-dense w-full text-left"><thead class="bg-slate-50 text-xs text-slate-500 uppercase">' +
      '<tr><th class="p-3">管理员手机号</th><th class="p-3">模块权限</th><th class="p-3">操作</th></tr></thead><tbody>' +
      (staffRows || '<tr><td colspan="3" class="p-6 text-slate-500">暂无管理员</td></tr>') +
      '</tbody></table></div>' +
      '<p class="text-xs text-slate-500">说明：未配置环境变量 <code class="bg-slate-100 px-1 rounded">ADMIN_PHONES</code> 时，内置白名单可登录管理端。主管理员也可在此直接添加管理员；新管理员默认无任何模块，需勾选后保存。</p>' +
      '</div>'
    );
  }

  function renderSystem() {
    const wh = !!state.flags.FEATURE_SMART_WAREHOUSE;
    return (
      '<div class="space-y-4"><h1 class="text-xl font-semibold">系统 · 功能开关</h1>' +
      '<div class="bg-white border border-slate-200 rounded-2xl p-5 max-w-lg">' +
      '<label class="flex items-center justify-between gap-4 cursor-pointer">' +
      '<span><span class="font-bold block">智能教学仓 (FEATURE_SMART_WAREHOUSE)</span>' +
      '<span class="text-xs text-slate-500">关闭时隐藏 IoT / 仓相关 UI（默认关）</span></span>' +
      '<input type="checkbox" id="flagWarehouse" ' +
      (wh ? 'checked' : '') +
      ' class="w-5 h-5"/></label>' +
      '<button type="button" id="btnSaveFlags" class="mt-4 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-bold">保存</button></div></div>'
    );
  }

  async function toggleAcceptingOrders(mentorId) {
    const m = state.mentors.find((x) => x.id === mentorId);
    if (!m) return;
    const next = m.acceptingOrders === false;
    await StorageService.updateMentor(mentorId, { acceptingOrders: next });
    await reloadCore();
    toast(next ? '已恢复接单' : '已暂停接单');
    renderMain();
  }

  function collectEvalRubricNotes() {
    const notes = {};
    document.querySelectorAll('[data-rubric-dim]').forEach((el) => {
      const key = el.getAttribute('data-rubric-dim');
      if (!key) return;
      const val = (el.value || '').trim();
      if (val) notes[key] = val;
    });
    return notes;
  }

  async function saveMentorRating() {
    const sel = state.mentors.find((m) => m.id === state.selectedMentorId);
    if (!sel) return;
    const gradeEl = document.getElementById('auditEvalGrade');
    const evalGrade = (gradeEl && gradeEl.value) || sel.evalGrade || '待教研评级';
    const evalRubricNotes = collectEvalRubricNotes();
    await StorageService.updateMentor(sel.id, { evalGrade, evalRubricNotes });
    await reloadCore();
    toast('教研评级已保存');
    renderMain();
  }

  async function applyAudit(status) {
    const sel = state.mentors.find((m) => m.id === state.selectedMentorId);
    if (!sel) return;
    const comment = (document.getElementById('auditComment') || {}).value || '';
    const gradeEl = document.getElementById('auditEvalGrade');
    let evalGrade = (gradeEl && gradeEl.value) || sel.evalGrade;
    const evalRubricNotes = collectEvalRubricNotes();
    const patch = { status, reviewComment: comment, evalRubricNotes };
    if (status === 'approved') {
      if (!evalGrade || evalGrade === '待教研评级') evalGrade = 'V2 级金牌导师';
      patch.evalGrade = evalGrade;
    } else if (status === 'supplement') {
      patch.evalGrade = evalGrade && evalGrade !== '待教研评级' ? evalGrade : '待复评';
    } else if (status === 'rejected') {
      patch.evalGrade = evalGrade === '待教研评级' || !evalGrade ? '不予评级' : evalGrade;
    } else if (evalGrade) {
      patch.evalGrade = evalGrade;
    }
    await StorageService.updateMentor(sel.id, patch);
    await reloadCore();
    toast('审核状态已更新');
    renderMain();
  }

  function bindMainHandlers() {
    bindBookingDetailModalHandlers();
    document.querySelectorAll('[data-open-booking]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openBookingDetail(el.getAttribute('data-open-booking'));
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openBookingDetail(el.getAttribute('data-open-booking'));
        }
      });
    });
    const saveRating = document.getElementById('btnSaveMentorRating');
    if (saveRating) {
      saveRating.addEventListener('click', () => saveMentorRating());
    }
    document.querySelectorAll('[data-nav-main]').forEach(() => {});
    document.querySelectorAll('[data-pick-mentor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedMentorId = btn.getAttribute('data-pick-mentor');
        renderMain();
      });
    });
    document.querySelectorAll('[data-audit-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.auditFilter = btn.getAttribute('data-audit-filter');
        renderMain();
      });
    });
    document.querySelectorAll('[data-audit]').forEach((btn) => {
      btn.addEventListener('click', () => applyAudit(btn.getAttribute('data-audit')));
    });
    document.querySelectorAll('[data-toggle-accept]').forEach((btn) => {
      btn.addEventListener('click', () => toggleAcceptingOrders(btn.getAttribute('data-toggle-accept')));
    });
    const escrowBtn = document.getElementById('btnProcessEscrow');
    if (escrowBtn) {
      escrowBtn.addEventListener('click', async () => {
        try {
          await AdminApi.processEscrow();
          await reloadCore();
          toast('托管释放扫描完成');
          renderMain();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    }
    const parentSearch = document.getElementById('parentSearch');
    if (parentSearch) {
      parentSearch.addEventListener('input', () => renderMain());
    }
    document.querySelectorAll('[data-fb-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.feedbackFilter = btn.getAttribute('data-fb-filter');
        renderMain();
      });
    });
    document.querySelectorAll('[data-fb-status]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-fb-id');
        const st = btn.getAttribute('data-fb-status');
        try {
          await AdminApi.patchFeedback(id, {
            status: st,
            handledAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            handledBy: state.adminLabel
          });
          await reloadCore();
          toast('反馈已更新');
          renderMain();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
    document.querySelectorAll('[data-fb-note]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-fb-note');
        const note = window.prompt('处理备注');
        if (note == null) return;
        try {
          await AdminApi.patchFeedback(id, { handlerNote: note });
          await reloadCore();
          renderMain();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
    document.querySelectorAll('[data-fb-reply]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-fb-reply');
        const ticket = state.feedback.find((t) => t.id === id);
        const reply = window.prompt('回复用户（将展示在工单中）', (ticket && ticket.adminReply) || '');
        if (reply == null || !String(reply).trim()) return;
        try {
          await AdminApi.patchFeedback(id, {
            adminReply: String(reply).trim(),
            repliedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            repliedBy: state.adminLabel,
            status: ticket && ticket.status === '待处理' ? '处理中' : ticket && ticket.status
          });
          await reloadCore();
          toast('回复已保存');
          renderMain();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
    const saveFlags = document.getElementById('btnSaveFlags');
    if (saveFlags) {
      saveFlags.addEventListener('click', async () => {
        const on = !!(document.getElementById('flagWarehouse') || {}).checked;
        try {
          state.flags = await AdminApi.patchFeatureFlags({ FEATURE_SMART_WAREHOUSE: on });
          toast('功能开关已保存');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    }
    const reloadPay = document.getElementById('btnReloadPay');
    if (reloadPay) reloadPay.addEventListener('click', () => loadPayOrders());
    const paySearch = document.getElementById('btnPaySearch');
    if (paySearch) paySearch.addEventListener('click', () => loadPayOrders());
    const payExport = document.getElementById('btnPayExport');
    if (payExport) payExport.addEventListener('click', () => exportPayOrdersXlsx());
    document.querySelectorAll('[data-refund]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const out = btn.getAttribute('data-refund');
        if (!window.confirm('确认对订单 ' + out + ' 发起退款？')) return;
        const reason = window.prompt('退款原因（可选）') || '';
        try {
          await AdminApi.refundOrder(out, reason);
          toast('退款成功');
          loadPayOrders();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
    if (state.route === 'payments') loadPayOrders();

    document.querySelectorAll('[data-pick-assessment]').forEach((btn) => {
      btn.addEventListener('click', () => openAssessmentDetail(btn.getAttribute('data-pick-assessment')));
    });
    if (state.route === 'assessments' && state.selectedAssessmentId && !state.assessmentDetail) {
      openAssessmentDetail(state.selectedAssessmentId);
    }

    document.querySelectorAll('[data-subject-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.subjectTagFilter = btn.getAttribute('data-subject-filter') || '';
        renderMain();
      });
    });
    document.querySelectorAll('[data-booking-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.bookingListFilter = btn.getAttribute('data-booking-filter') || 'all';
        renderMain();
      });
    });
    document.querySelectorAll('[data-tp-save]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-tp-save');
        const input = document.querySelector('[data-tp-count="' + id + '"]');
        const count = input ? parseInt(input.value, 10) : 3;
        try {
          await AdminApi.patchTeachingPoint(id, { boothCount: count });
          await reloadCore();
          toast('仓位数量已更新');
          renderMain();
        } catch (e) {
          toast((e.data && e.data.error) || e.message || '保存失败', 'error');
        }
      });
    });
    const occBtn = document.getElementById('btnTpOccupancy');
    if (occBtn) {
      occBtn.addEventListener('click', () => loadTeachingPointOccupancy());
    }
    const tpSel = document.getElementById('tpOccSelect');
    if (tpSel) {
      tpSel.addEventListener('change', () => {
        state.tpOccupancyTpId = tpSel.value;
      });
    }
    const tpDate = document.getElementById('tpOccDate');
    if (tpDate) {
      tpDate.addEventListener('change', () => {
        state.tpOccupancyDate = tpDate.value;
      });
    }
    document.querySelectorAll('[data-rbac-mod]').forEach((input) => {
      input.addEventListener('change', () => {
        const phone = input.getAttribute('data-rbac-phone');
        const mod = input.getAttribute('data-rbac-mod');
        if (!phone || !mod) return;
        const list = (state.rbacDraft[phone] || []).slice();
        const idx = list.indexOf(mod);
        if (input.checked && idx < 0) list.push(mod);
        if (!input.checked && idx >= 0) list.splice(idx, 1);
        state.rbacDraft[phone] = list;
      });
    });
    document.querySelectorAll('[data-rbac-save]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const phone = btn.getAttribute('data-rbac-save');
        if (!phone) return;
        const modules = state.rbacDraft[phone] || [];
        try {
          await AdminApi.patchAdminRbacStaff(phone, modules);
          toast('权限已保存');
          await loadRbacStaff();
          renderMain();
        } catch (e) {
          toast(e.message || '保存失败', 'error');
        }
      });
    });
    const openAddParent = document.getElementById('btnOpenAddParent');
    if (openAddParent) {
      openAddParent.addEventListener('click', () => {
        state.parentFormOpen = !state.parentFormOpen;
        renderMain();
      });
    }
    const cancelAddParent = document.getElementById('btnCancelAddParent');
    if (cancelAddParent) {
      cancelAddParent.addEventListener('click', () => {
        state.parentFormOpen = false;
        state.parentDraft = { phone: '', parentName: '', studentNickname: '', studentGrade: '', parentRole: '家长' };
        renderMain();
      });
    }
    const addParentForm = document.getElementById('addParentForm');
    if (addParentForm) {
      addParentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        captureParentDraft();
        const draft = state.parentDraft;
        try {
          await AdminApi.createParent({
            phone: String(draft.phone || '').trim(),
            parentName: String(draft.parentName || '').trim(),
            studentNickname: String(draft.studentNickname || '').trim(),
            studentGrade: String(draft.studentGrade || '').trim(),
            parentRole: draft.parentRole || '家长'
          });
          state.parentFormOpen = false;
          state.parentDraft = { phone: '', parentName: '', studentNickname: '', studentGrade: '', parentRole: '家长' };
          await reloadCore();
          toast('家长已添加');
          renderMain();
        } catch (err) {
          toast(apiErrorMessage(err, '添加家长失败'), 'error');
        }
      });
    }
    document.querySelectorAll('[data-delete-parent]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete-parent');
        const label = btn.getAttribute('data-delete-label') || '该家长';
        const yes = await confirmAction({
          title: '删除家长',
          message:
            '确认删除家长「' +
            label +
            '」？进行中的预约或未完结订单会阻止删除。历史预约与支付记录会保留，该手机号将无法再登录。'
        });
        if (!yes) return;
        try {
          await AdminApi.deleteParent(id);
          await reloadCore();
          toast('家长已删除');
          renderMain();
        } catch (err) {
          toast(apiErrorMessage(err, '删除家长失败'), 'error');
        }
      });
    });
    const openAddMentor = document.getElementById('btnOpenAddMentor');
    if (openAddMentor) {
      openAddMentor.addEventListener('click', () => {
        state.mentorFormOpen = !state.mentorFormOpen;
        renderMain();
      });
    }
    const cancelAddMentor = document.getElementById('btnCancelAddMentor');
    if (cancelAddMentor) {
      cancelAddMentor.addEventListener('click', () => {
        state.mentorFormOpen = false;
        state.mentorDraft = { phone: '', realName: '', university: '', hourlyRate: '' };
        renderMain();
      });
    }
    const addMentorForm = document.getElementById('addMentorForm');
    if (addMentorForm) {
      addMentorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        captureMentorDraft();
        const draft = state.mentorDraft;
        const payload = {
          phone: String(draft.phone || '').trim(),
          realName: String(draft.realName || '').trim(),
          university: String(draft.university || '').trim()
        };
        if (String(draft.hourlyRate || '').trim()) payload.hourlyRate = String(draft.hourlyRate).trim();
        try {
          await AdminApi.createMentor(payload);
          state.mentorFormOpen = false;
          state.mentorDraft = { phone: '', realName: '', university: '', hourlyRate: '' };
          await reloadCore();
          toast('导师已添加，状态为待审核');
          renderMain();
        } catch (err) {
          toast(apiErrorMessage(err, '添加导师失败'), 'error');
        }
      });
    }
    document.querySelectorAll('[data-delete-mentor]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete-mentor');
        const label = btn.getAttribute('data-delete-label') || '该导师';
        const yes = await confirmAction({
          title: '删除导师',
          message:
            '确认删除导师「' +
            label +
            '」？进行中的预约或未完结订单会阻止删除。历史预约、支付与佐证材料记录会保留，该手机号将无法再登录。'
        });
        if (!yes) return;
        try {
          await AdminApi.deleteMentor(id);
          await reloadCore();
          toast('导师已删除');
          renderMain();
        } catch (err) {
          toast(apiErrorMessage(err, '删除导师失败'), 'error');
        }
      });
    });
    const openAddTp = document.getElementById('btnOpenAddTeachingPoint');
    if (openAddTp) {
      openAddTp.addEventListener('click', () => {
        state.teachingPointFormOpen = !state.teachingPointFormOpen;
        renderMain();
      });
    }
    const cancelAddTp = document.getElementById('btnCancelAddTeachingPoint');
    if (cancelAddTp) {
      cancelAddTp.addEventListener('click', () => {
        state.teachingPointFormOpen = false;
        state.teachingPointDraftName = '';
        renderMain();
      });
    }
    const addTpForm = document.getElementById('addTeachingPointForm');
    if (addTpForm) {
      addTpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        captureTeachingPointDraft();
        try {
          await AdminApi.createTeachingPoint({ name: String(state.teachingPointDraftName || '').trim() });
          state.teachingPointFormOpen = false;
          state.teachingPointDraftName = '';
          await reloadCore();
          toast('教学点已添加，已生成 3 个仓位');
          renderMain();
        } catch (err) {
          toast(apiErrorMessage(err, '添加教学点失败'), 'error');
        }
      });
    }
    document.querySelectorAll('[data-tp-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-tp-delete');
        const name = btn.getAttribute('data-tp-name') || '该教学点';
        const yes = await confirmAction({
          title: '删除教学点',
          message:
            '确认删除教学点「' +
            name +
            '」及其编号仓位？若仍有进行中的预约或占用仓位，系统会拒绝删除。已结束的预约记录会保留。'
        });
        if (!yes) return;
        try {
          await AdminApi.deleteTeachingPoint(id);
          if (state.tpOccupancyTpId === id) {
            state.tpOccupancyTpId = '';
            state.tpOccupancy = null;
          }
          await reloadCore();
          toast('教学点已删除');
          renderMain();
        } catch (err) {
          toast(apiErrorMessage(err, '删除教学点失败'), 'error');
        }
      });
    });
    const addAdminForm = document.getElementById('addAdminForm');
    if (addAdminForm) {
      addAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isPrimaryAdminUser()) {
          toast('仅主管理员可添加管理员', 'error');
          return;
        }
        const phone = String((document.getElementById('addAdminPhone') || {}).value || '').trim();
        try {
          await AdminApi.createAdminStaff(phone);
          toast('管理员已添加，请勾选模块后保存');
          await loadRbacStaff();
          renderMain();
        } catch (err) {
          toast(apiErrorMessage(err, '添加管理员失败'), 'error');
        }
      });
    }
    document.querySelectorAll('[data-rbac-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!isPrimaryAdminUser()) {
          toast('仅主管理员可移除管理员', 'error');
          return;
        }
        const phone = btn.getAttribute('data-rbac-remove');
        const yes = await confirmAction({
          title: '移除管理员',
          message: '确认移除管理员 ' + phone + '？移除后该手机号将无法登录运营中台。主管理员不能被移除。'
        });
        if (!yes) return;
        try {
          await AdminApi.deleteAdminStaff(phone);
          toast('管理员已移除');
          await loadRbacStaff();
          renderMain();
        } catch (err) {
          toast(apiErrorMessage(err, '移除管理员失败'), 'error');
        }
      });
    });
  }

  async function loadTeachingPointOccupancy() {
    const sel = document.getElementById('tpOccSelect');
    const dateEl = document.getElementById('tpOccDate');
    const id = (sel && sel.value) || state.tpOccupancyTpId;
    const date = (dateEl && dateEl.value) || state.tpOccupancyDate || todayIso();
    if (!id) return;
    state.tpOccupancyTpId = id;
    state.tpOccupancyDate = date;
    try {
      state.tpOccupancy = await AdminApi.getTeachingPointOccupancy(id, { date });
      renderMain();
    } catch (e) {
      toast(e.message || '查询占用失败', 'error');
    }
  }

  async function init() {
    const ok = await ensureAdmin();
    if (!ok) return;
    await reloadCore();
    const hash = (window.location.hash || '').replace('#', '');
    const initial = hash || firstAllowedRoute() || 'dashboard';
    setRoute(initial);
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        setRoute(el.getAttribute('data-nav'));
      });
    });
    document.getElementById('btnLogout').addEventListener('click', async () => {
      await StorageService.confirmAndLogout('../login.html');
    });
    window.addEventListener('hashchange', () => {
      const h = (window.location.hash || '').replace('#', '');
      if (h && h !== state.route) setRoute(h);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
