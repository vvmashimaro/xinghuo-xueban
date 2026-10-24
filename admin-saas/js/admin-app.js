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
    assessmentDetail: null
  };

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
    if (!me || me.role !== 'admin') {
      toast('需要管理员账号登录', 'error');
      window.location.href = '../login.html';
      return false;
    }
    state.adminLabel = me.phone || '管理员';
    document.getElementById('adminUserLabel').textContent = state.adminLabel;
    return true;
  }

  async function reloadCore() {
    await StorageService.hydrateFromServer();
    state.mentors = StorageService.getMentors();
    state.parents = StorageService.getParents();
    state.bookings = StorageService.getBookings();
    state.contracts = StorageService.getContracts ? StorageService.getContracts() : [];
    state.assessments = StorageService.getAssessments ? StorageService.getAssessments() : [];
    state.feedback = StorageService.getFeedbackTickets ? StorageService.getFeedbackTickets() : [];
    try {
      const flagRes = await AdminApi.getFeatureFlags();
      state.flags = flagRes || {};
    } catch (e) {
      state.flags = { FEATURE_SMART_WAREHOUSE: false };
    }
    try {
      state.subjectCatalog = await AdminApi.getSubjectCatalog();
    } catch (e) {
      state.subjectCatalog = null;
    }
    try {
      state.teachingPoints = normalizeTeachingPoints(await AdminApi.listTeachingPoints());
    } catch (e) {
      state.teachingPoints = [];
    }
    if (!state.tpOccupancyDate) state.tpOccupancyDate = todayIso();
    if (!state.tpOccupancyTpId && state.teachingPoints[0]) {
      state.tpOccupancyTpId = state.teachingPoints[0].id;
    }
  }

  function setRoute(route) {
    state.route = route || 'dashboard';
    if (route === 'audit' && !state.selectedMentorId) {
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
    else main.innerHTML = '<p class="text-slate-500">页面不存在</p>';
    bindMainHandlers();
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
                '<li class="flex justify-between gap-2 border-b border-slate-100 pb-2">' +
                '<span>' +
                esc(b.id) +
                ' · ' +
                esc(b.subject) +
                '</span><span class="text-slate-500">' +
                esc(b.status) +
                (b.hasTimeConflict ? ' · <span class="text-amber-700">冲突</span>' : '') +
                '</span></li>'
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
          '<div class="font-bold">' +
          esc(m.realName) +
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

  function renderParents() {
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
      '<div class="space-y-4"><h1 class="text-xl font-semibold">家长用户</h1>' +
      subjectFilterBarHtml() +
      '<input id="parentSearch" placeholder="手机号 / 姓名" class="border border-slate-300 rounded-xl px-3 py-2 text-sm w-full max-w-xs" value="' +
      esc(needle) +
      '"/>' +
      '<div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">' +
      '<table class="admin-dense w-full text-sm"><thead class="bg-slate-50 text-slate-500"><tr><th class="text-left p-3">姓名</th><th class="text-left p-3">手机</th><th class="text-left p-3">学员</th><th class="text-left p-3">目标学科</th></tr></thead><tbody>' +
      rows
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
            '</td></tr>'
        )
        .join('') +
      '</tbody></table></div></div>'
    );
  }

  function renderMentorsList() {
    return (
      '<div class="space-y-4"><h1 class="text-xl font-semibold">导师用户</h1>' +
      subjectFilterBarHtml() +
      '<div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">' +
      '<table class="admin-dense w-full text-sm"><thead class="bg-slate-50 text-slate-500"><tr><th class="text-left p-3">姓名</th><th class="text-left p-3">手机</th><th class="text-left p-3">学科</th><th class="text-left p-3">状态</th><th class="text-left p-3">接单</th><th></th></tr></thead><tbody>' +
      state.mentors
        .filter((m) => {
          const tag = state.subjectTagFilter;
          if (!tag) return true;
          const subs = (m.subjects || []).concat(m.customSubjects || []).join(' ');
          return matchesSubjectTag(subs, tag);
        })
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
            esc(STATUS_LABEL[m.status] || m.status) +
            '</td><td class="p-3">' +
            (m.acceptingOrders === false ? '暂停' : '正常') +
            '</td><td class="p-3"><button type="button" data-toggle-accept="' +
            esc(m.id) +
            '" class="text-teal-700 text-xs font-bold">切换接单</button></td></tr>'
          );
        })
        .join('') +
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
                '<tr class="border-t border-slate-100' +
                (b.hasTimeConflict ? ' bg-amber-50/40' : '') +
                '"><td class="p-3 font-mono text-xs">' +
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
                esc(b.status) +
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

  function renderTeachingPoints() {
    let tps = state.teachingPoints || [];
    if (!tps.length && window.StorageService && StorageService.SPACE_OPTIONS) {
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
      '<h1 class="text-xl font-semibold">教学点仓位管理</h1>' +
      '<p class="text-sm text-slate-500">默认每网点 3 个编号仓位；缩减仓位前须确保无有效预约占用将被移除的仓位。智能仓 IoT 功能保持关闭。</p>' +
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
            '</div></div>' +
            '<div class="flex flex-wrap gap-1">' +
            boothTags +
            '</div></div>'
          );
        })
        .join('') +
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

  async function applyAudit(status) {
    const sel = state.mentors.find((m) => m.id === state.selectedMentorId);
    if (!sel) return;
    const comment = (document.getElementById('auditComment') || {}).value || '';
    const patch = { status, reviewComment: comment };
    if (status === 'approved' && (!sel.evalGrade || sel.evalGrade === '待教研评级')) {
      patch.evalGrade = 'V2 级金牌导师';
    }
    await StorageService.updateMentor(sel.id, patch);
    await reloadCore();
    toast('审核状态已更新');
    renderMain();
  }

  function bindMainHandlers() {
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
    const hash = (window.location.hash || '#dashboard').replace('#', '');
    setRoute(hash || 'dashboard');
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        setRoute(el.getAttribute('data-nav'));
      });
    });
    document.getElementById('btnLogout').addEventListener('click', async () => {
      await StorageService.logout();
      window.location.href = '../login.html';
    });
    window.addEventListener('hashchange', () => {
      const h = (window.location.hash || '#dashboard').replace('#', '');
      if (h !== state.route) {
        state.route = h;
        renderMain();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
