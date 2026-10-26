/**
 * 星火学伴 · E+C 混搭家长找学伴（年级→学科表单 + 翻牌匹配）
 */
(function (global) {
  'use strict';

  const GRADE_SUBJECTS = {
    小学: ['语文', '数学', '英语'],
    初中: ['语文', '数学', '英语', '物理', '化学', '初中体育'],
    高中: ['语文', '数学', '英语', '物理', '化学', '生物'],
    考研: ['考研数学', '考研英语', '考研政治'],
    艺体: ['美术', '音乐', '体育', '舞蹈']
  };

  const TIME_OPTIONS = ['全部', '工作日晚', '周末上午', '周末下午', '周末晚', '全天'];
  const STORAGE_KEY = 'xh_ec_browse_v1';
  const LIKED_KEY = 'xh_ec_browse_liked_v1';

  const state = {
    grade: null,
    subject: null,
    time: '全部',
    queue: [],
    idx: 0,
    liked: 0,
    likedIds: [],
    animating: false,
    mentors: []
  };

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

  function inferGradeBands(mentor) {
    const subjects = []
      .concat(mentor.subjects || [], mentor.customSubjects || [])
      .map(String);
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
      .map(String);
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
    const bands = inferGradeBands(mentor);
    if (bands.indexOf(grade) >= 0) return true;
    if (grade === '艺体') {
      const subj = []
        .concat(mentor.subjects || [], mentor.customSubjects || [])
        .join(' ');
      return /艺体|钢琴|美术|音乐|体育|舞蹈|艺考/.test(subj);
    }
    return false;
  }

  function availabilityText(mentor) {
    const parts = [];
    (mentor.availableSlots || []).forEach((s) => parts.push(String(s)));
    (mentor.availability || []).forEach((w) => {
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

  function filterMentors(mentors, opts) {
    return (mentors || []).filter((m) => {
      if (!mentorMatchesGrade(m, opts.grade)) return false;
      if (!mentorMatchesSubject(m, opts.subject)) return false;
      if (!mentorMatchesTime(m, opts.time)) return false;
      return true;
    });
  }

  function stripForBrowse(m) {
    if (!m) return m;
    const out = Object.assign({}, m);
    delete out.phone;
    delete out.idCard;
    delete out.bankCardNumber;
    delete out.bankName;
    delete out.chsiCode;
    delete out.lectureUrl;
    delete out.reviewComment;
    return out;
  }

  function localApprovedMentors() {
    if (!global.StorageService) return [];
    const list = StorageService.getApprovedMentors
      ? StorageService.getApprovedMentors()
      : (StorageService.getMentors() || []).filter(
          (m) => m.status === 'approved' && m.acceptingOrders !== false
        );
    return list.map(stripForBrowse);
  }

  async function loadMentors() {
    if (global.StorageService && StorageService.fetchPublicMentorsForBrowse) {
      const remote = await StorageService.fetchPublicMentorsForBrowse();
      if (Array.isArray(remote) && remote.length) return remote;
    }
    return localApprovedMentors();
  }

  function avatarGradient(id) {
    const hues = ['#0d9488', '#14b8a6', '#0f766e', '#115e59', '#134e4a'];
    let n = 0;
    String(id || '').split('').forEach((c) => {
      n += c.charCodeAt(0);
    });
    return hues[n % hues.length];
  }

  function displaySlots(mentor) {
    const out = [];
    (mentor.availableSlots || []).slice(0, 4).forEach((s) => out.push(String(s)));
    if (!out.length && mentor.availability && mentor.availability.length) {
      mentor.availability.slice(0, 2).forEach((w) => {
        if (w && w.label) out.push(w.label);
      });
    }
    if (!out.length) out.push('时段可协商');
    return out;
  }

  function priceBand(mentor) {
    const rate = Number(mentor.hourlyRate) || 0;
    if (!rate) return '课酬面议';
    const lo = Math.max(60, Math.round(rate * 0.9));
    const hi = Math.round(rate * 1.1);
    return '¥' + lo + '–' + hi + '/时';
  }

  function persistState() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          grade: state.grade,
          subject: state.subject,
          time: state.time,
          idx: state.idx,
          liked: state.liked,
          likedIds: state.likedIds,
          step: document.getElementById('ec-step2') &&
            !document.getElementById('ec-step2').classList.contains('hidden')
            ? 2
            : 1
        })
      );
    } catch (e) {}
  }

  function loadPersistedLiked() {
    try {
      const raw = localStorage.getItem(LIKED_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveLikedIds(ids) {
    try {
      localStorage.setItem(LIKED_KEY, JSON.stringify(ids || []));
    } catch (e) {}
  }

  function buildReturnUrl() {
    const q = new URLSearchParams();
    q.set('entry', 'browse');
    if (state.grade) q.set('grade', state.grade);
    if (state.subject) q.set('subject', state.subject);
    if (state.time && state.time !== '全部') q.set('time', state.time);
    q.set('step', 'swipe');
    if (state.likedIds.length) q.set('liked', state.likedIds.join(','));
    return 'index.html?' + q.toString();
  }

  function isLoggedInParent() {
    const session = global.StorageService && StorageService.getSession && StorageService.getSession();
    return !!(session && session.role === 'parent' && StorageService.isLoggedIn && StorageService.isLoggedIn());
  }

  function openLoginWall(mentor) {
    persistState();
    const name = (mentor && (mentor.maskedName || mentor.realName)) || '导师';
    const ret = encodeURIComponent(buildReturnUrl());
    const url =
      'login.html?role=parent&return=' +
      ret +
      '&hint=' +
      encodeURIComponent('登录后继续对「' + name + '」表达感兴趣');
    if (typeof global.safeNavigate === 'function') {
      global.safeNavigate(url, '家长登录');
    } else {
      global.location.href = url;
    }
  }

  function bindGradeChips() {
    const el = document.getElementById('ec-grd');
    if (!el) return;
    const grades = Object.keys(GRADE_SUBJECTS);
    el.innerHTML = grades
      .map(
        (it) =>
          '<button type="button" class="ec-chip' +
          (state.grade === it ? ' on' : '') +
          '" data-v="' +
          it +
          '">' +
          it +
          '</button>'
      )
      .join('');
    el.querySelectorAll('.ec-chip').forEach((c) => {
      c.onclick = function () {
        const v = c.getAttribute('data-v');
        if (state.grade !== v) {
          state.grade = v;
          state.subject = null;
        }
        bindGradeChips();
        bindSubjectChips();
        persistState();
      };
    });
  }

  function bindSubjectChips() {
    const el = document.getElementById('ec-sub');
    if (!el) return;
    if (!state.grade) {
      el.innerHTML = '<span class="ec-chip-hint">先选年级</span>';
      return;
    }
    const items = GRADE_SUBJECTS[state.grade] || [];
    el.innerHTML = items
      .map(
        (it) =>
          '<button type="button" class="ec-chip' +
          (state.subject === it ? ' on' : '') +
          '" data-v="' +
          it +
          '">' +
          it +
          '</button>'
      )
      .join('');
    el.querySelectorAll('.ec-chip').forEach((c) => {
      c.onclick = function () {
        state.subject = c.getAttribute('data-v');
        bindSubjectChips();
        persistState();
      };
    });
  }

  function bindTimeChips() {
    const el = document.getElementById('ec-tm');
    if (!el) return;
    el.innerHTML = TIME_OPTIONS
      .map(
        (it) =>
          '<button type="button" class="ec-chip' +
          (state.time === it ? ' on' : '') +
          '" data-v="' +
          it +
          '">' +
          it +
          '</button>'
      )
      .join('');
    el.querySelectorAll('.ec-chip').forEach((c) => {
      c.onclick = function () {
        state.time = c.getAttribute('data-v');
        bindTimeChips();
        persistState();
      };
    });
  }

  function showStep(n) {
    const s1 = document.getElementById('ec-step1');
    const s2 = document.getElementById('ec-step2');
    if (s1) s1.classList.toggle('hidden', n !== 1);
    if (s2) s2.classList.toggle('hidden', n !== 2);
    const d1 = document.getElementById('ec-d1');
    const d2 = document.getElementById('ec-d2');
    if (d1) d1.className = 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ' + (n === 1 ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-800');
    if (d2) d2.className = 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ' + (n === 2 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600');
    global.scrollTo({ top: 0, behavior: 'smooth' });
    persistState();
  }

  function updateCounter() {
    const el = document.getElementById('ec-counter');
    if (el) el.textContent = '已感兴趣 ' + state.liked;
  }

  function showEmpty(yes) {
    const phone = document.getElementById('ec-phone-wrap');
    const tip = document.getElementById('ec-tip');
    const empty = document.getElementById('ec-empty');
    if (phone) phone.classList.toggle('hidden', yes);
    if (tip) tip.classList.toggle('hidden', yes);
    if (empty) empty.classList.toggle('hidden', !yes);
  }

  function showDone() {
    const card = document.getElementById('ec-card');
    const controls = document.getElementById('ec-controls');
    const done = document.getElementById('ec-done');
    const msg = document.getElementById('ec-done-msg');
    if (card) card.style.display = 'none';
    if (controls) controls.style.display = 'none';
    if (done) done.classList.remove('hidden');
    if (msg) {
      msg.textContent =
        '共翻完 ' + state.queue.length + ' 位匹配学伴 · 已感兴趣 ' + state.liked + ' 人';
    }
  }

  function renderCard() {
    if (!state.queue.length) {
      showEmpty(true);
      return;
    }
    showEmpty(false);
    if (state.idx >= state.queue.length) {
      showDone();
      return;
    }
    const done = document.getElementById('ec-done');
    const card = document.getElementById('ec-card');
    const controls = document.getElementById('ec-controls');
    if (done) done.classList.add('hidden');
    if (card) {
      card.style.display = '';
      card.className = 'ec-swipe-card relative z-10 mx-3 mt-6 mb-3 bg-white rounded-2xl border border-slate-200 shadow-md p-5 flex flex-col flex-1';
    }
    if (controls) controls.style.display = '';

    const m = state.queue[state.idx];
    const letter = (m.maskedName || m.realName || '导').charAt(0);
    const subjects = (m.subjects || []).slice(0, 4);
    const styles = (m.styles || []).slice(0, 2);
    const slots = displaySlots(m);
    const hl = m.scoreHighlight || '阳光合规 · 实名入库导师';
    const uni = (m.university || '双一流高校').split(/[·/]/)[0];
    const color = avatarGradient(m.id);

    card.innerHTML =
      '<div class="flex justify-center mb-3">' +
      '<div class="w-16 h-16 rounded-2xl text-white text-2xl font-black flex items-center justify-center shadow-lg" style="background:linear-gradient(135deg,' +
      color +
      ',#134e4a)">' +
      letter +
      '</div></div>' +
      '<h2 class="text-center text-xl font-black text-slate-900">' +
      (m.maskedName || m.realName || '导师') +
      '</h2>' +
      '<p class="text-center text-sm text-slate-500 mt-1">' +
      uni +
      (m.degree ? ' · ' + m.degree : '') +
      '</p>' +
      '<p class="text-center text-sm text-slate-700 mt-4 flex-1 leading-relaxed">' +
      hl +
      '</p>' +
      '<div class="flex flex-wrap gap-1 justify-center mt-3">' +
      subjects
        .map(
          (s) =>
            '<span class="text-xs bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md border border-teal-100">' +
            s +
            '</span>'
        )
        .join('') +
      styles
        .map(
          (s) =>
            '<span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">' +
            s +
            '</span>'
        )
        .join('') +
      '</div>' +
      '<div class="flex flex-wrap gap-1 justify-center mt-3">' +
      slots
        .map((s) => '<span class="ec-slot-pill">' + s + '</span>')
        .join('') +
      '</div>' +
      '<p class="text-center text-sm font-bold text-teal-700 mt-4">' +
      priceBand(m) +
      (m.spacePreference ? ' · ' + m.spacePreference : '') +
      '</p>';
  }

  function nextSwipe(dir, didLike) {
    if (state.animating || state.idx >= state.queue.length) return;
    state.animating = true;
    const m = state.queue[state.idx];
    const card = document.getElementById('ec-card');
    if (card) card.classList.add(dir === 'left' ? 'out-left' : 'out-right');
    setTimeout(function () {
      if (didLike) {
        state.liked += 1;
        if (m && m.id && state.likedIds.indexOf(m.id) < 0) {
          state.likedIds.push(m.id);
          saveLikedIds(state.likedIds);
        }
        updateCounter();
        if (isLoggedInParent()) {
          if (typeof global.showToast === 'function') {
            global.showToast('已加入感兴趣名单，可在家长中心预约', 'success');
          }
        } else {
          openLoginWall(m);
        }
      }
      state.idx += 1;
      state.animating = false;
      renderCard();
      persistState();
    }, 260);
  }

  async function startSwipe() {
    if (!state.grade || !state.subject) {
      if (typeof global.showToast === 'function') {
        global.showToast('请先选择年级和学科', 'warning');
      } else {
        global.alert('请先选择年级和学科');
      }
      return;
    }
    state.mentors = await loadMentors();
    state.queue = filterMentors(state.mentors, {
      grade: state.grade,
      subject: state.subject,
      time: state.time
    });
    if (!state.queue.length && state.time !== '全部') {
      state.queue = filterMentors(state.mentors, {
        grade: state.grade,
        subject: state.subject,
        time: '全部'
      });
    }
    state.idx = 0;
    state.liked = state.likedIds.length;
    state.animating = false;
    updateCounter();
    const summary = document.getElementById('ec-summary');
    if (summary) {
      summary.textContent =
        state.grade +
        ' · ' +
        state.subject +
        (state.time && state.time !== '全部' ? ' · ' + state.time : '') +
        ' · ' +
        state.queue.length +
        ' 位';
    }
    showStep(2);
    renderCard();
    persistState();
  }

  function backToForm() {
    showStep(1);
  }

  function applyQueryBoot() {
    try {
      const q = new URLSearchParams(global.location.search || '');
      if (q.get('grade')) state.grade = q.get('grade');
      if (q.get('subject')) state.subject = q.get('subject');
      if (q.get('time')) state.time = q.get('time');
      const liked = q.get('liked');
      if (liked) {
        state.likedIds = liked.split(',').filter(Boolean);
        state.liked = state.likedIds.length;
        saveLikedIds(state.likedIds);
      }
    } catch (e) {}
  }

  function bindEvents() {
    const go = document.getElementById('ec-go');
    if (go) go.onclick = startSwipe;
    ['ec-back', 'ec-back2', 'ec-back-empty'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.onclick = backToForm;
    });
    const skip = document.getElementById('ec-skip');
    const like = document.getElementById('ec-like');
    if (skip) skip.onclick = function () {
      nextSwipe('left', false);
    };
    if (like) like.onclick = function () {
      nextSwipe('right', true);
    };
    const again = document.getElementById('ec-again');
    if (again) {
      again.onclick = function () {
        state.idx = 0;
        updateCounter();
        const done = document.getElementById('ec-done');
        if (done) done.classList.add('hidden');
        renderCard();
      };
    }
    const loginList = document.getElementById('ec-login-list');
    if (loginList) {
      loginList.onclick = function () {
        if (isLoggedInParent()) {
          const url = 'parent_dashboard.html?tab=discover&liked=' + encodeURIComponent(state.likedIds.join(','));
          if (typeof global.safeNavigate === 'function') global.safeNavigate(url, '家长匹配中心');
          else global.location.href = url;
          return;
        }
        openLoginWall({ maskedName: '已感兴趣名单（' + state.liked + ' 人）' });
      };
    }
  }

  function init() {
    state.likedIds = loadPersistedLiked();
    state.liked = state.likedIds.length;
    applyQueryBoot();
    bindGradeChips();
    bindSubjectChips();
    bindTimeChips();
    bindEvents();
    updateCounter();
    try {
      const q = new URLSearchParams(global.location.search || '');
      if (q.get('step') === 'swipe' && state.grade && state.subject) {
        startSwipe();
      }
    } catch (e) {}
  }

  global.ParentBrowseEcHybrid = {
    init,
    GRADE_SUBJECTS,
    TIME_OPTIONS
  };
})(window);
