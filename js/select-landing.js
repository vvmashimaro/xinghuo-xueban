/**
 * 家长「选择学伴」：年级 → 科目 → 风格，或随便看看。
 * 按需匹配读取现有公开导师接口。
 * 「随便看看」只读 XINGHUO_BROWSE_DISPLAY_ROSTER，不进入预约。
 */
(function (global) {
  'use strict';

  var HERO = 'assets/homepage/tutor-student-hero.jpg';
  var GRADES = ['小学低年级', '小学高年级', '初一', '初二', '初三', '高一', '高二', '高三'];
  var SUBJECTS = ['语文', '数学', '英语', '物理', '化学'];
  var STYLES = ['引导启发', '拆题耐心', '跟读带练', '应试提分'];

  var state = {
    view: 'intake',
    step: 0,
    grade: '',
    subject: '',
    style: '',
    casual: false,
    mode: 'intake',
    index: 0,
    list: [],
    all: [],
    matchList: [],
    loading: false,
    loaded: false,
    matchLoaded: false,
    pickedName: '',
    pickedNote: ''
  };

  function cardApi() {
    return global.XinghuoCompanionCard;
  }

  function navigate(url, title) {
    if (typeof global.safeNavigate === 'function') global.safeNavigate(url, title || '');
    else global.location.href = url;
  }

  function stripSensitive(mentor) {
    var out = {};
    var key;
    for (key in mentor) {
      if (!Object.prototype.hasOwnProperty.call(mentor, key)) continue;
      if (key === 'phone' || key === 'idCard' || key === 'bankCardNumber' || key === 'bankName' || key === 'chsiCode' || key === 'lectureUrl' || key === 'reviewComment') continue;
      out[key] = mentor[key];
    }
    return out;
  }

  async function ensureMentors() {
    if (state.matchLoaded) return state.matchList;
    state.loading = true;
    var list = [];
    try {
      if (global.StorageService && StorageService.fetchPublicMentorsForBrowse) {
        var remote = await StorageService.fetchPublicMentorsForBrowse();
        if (Array.isArray(remote) && remote.length) list = remote;
      }
    } catch (e) {}
    if (!list.length && global.StorageService && StorageService.getApprovedMentors) {
      try { list = StorageService.getApprovedMentors() || []; } catch (e2) { list = []; }
    }
    state.matchList = (list || []).map(stripSensitive);
    state.matchLoaded = true;
    state.loading = false;
    return state.matchList;
  }

  function displayRoster() {
    var api = cardApi();
    var raw = global.XINGHUO_BROWSE_DISPLAY_ROSTER;
    if (!api || !api.normalizeDisplayRoster) return [];
    return api.normalizeDisplayRoster(raw);
  }

  function rosterEntry(id) {
    if (!id) return null;
    var hit = null;
    displayRoster().forEach(function (item) {
      if (!hit && String(item.id) === String(id)) hit = item;
    });
    return hit;
  }

  function applyFilter() {
    var api = cardApi();
    var result = api.filterCompanions(state.all, {
      grade: state.grade,
      subject: state.subject,
      style: state.style,
      casual: state.casual
    });
    state.mode = result.mode;
    state.list = result.list;
    state.index = 0;
  }

  function isParentSession() {
    var session = global.StorageService && StorageService.getSession && StorageService.getSession();
    return !!(session && session.role === 'parent' && StorageService.isLoggedIn && StorageService.isLoggedIn());
  }

  function continueWith(mentor) {
    if (!mentor) return;
    var api = cardApi();
    var fromRoster = rosterEntry(mentor.id);
    var subject = fromRoster || mentor;
    if (fromRoster || (api.isDisplayOnly && api.isDisplayOnly(mentor))) {
      state.pickedName = '';
      state.pickedNote = api.displayName(subject) + '尚未审核，暂不能预约。';
      state.view = 'cards';
      state.casual = true;
      state.all = displayRoster();
      state.loading = false;
      applyFilter();
      render();
      if (typeof global.showToast === 'function') global.showToast(state.pickedNote, 'warning');
      return;
    }
    var id = mentor.id || '';
    var name = api.displayName(mentor);
    state.pickedName = name;
    state.pickedNote = '';
    var ret = 'index.html?entry=browse&pick=' + encodeURIComponent(id) + '&resume=1';
    if (!isParentSession()) {
      navigate(
        'login.html?role=parent&return=' + encodeURIComponent(ret) + '&hint=' + encodeURIComponent('登录后继续选择「' + name + '」并预约试讲'),
        '家长登录'
      );
      return;
    }
    var session = StorageService.getSession();
    if (!session.parentId) {
      navigate('parent_register.html', '学情建档与注册');
      return;
    }
    navigate('parent_dashboard.html?book=' + encodeURIComponent(id), '预约试课');
  }

  function optionButtons(items, key) {
    return items.map(function (item) {
      var on = state[key] === item ? ' is-on' : '';
      return '<button class="xl-opt' + on + '" type="button" data-key="' + cardApi().esc(key) + '" data-val="' + cardApi().esc(item) + '">' + cardApi().esc(item) + '</button>';
    }).join('');
  }

  function renderIntake() {
    var steps = [
      { key: 'grade', title: '孩子目前的年级是？', sub: '选一个就好，后面还可以改。', items: GRADES },
      { key: 'subject', title: '这次最想补哪一门？', sub: '先选最要紧的一科。', items: SUBJECTS },
      { key: 'style', title: '更希望学伴是哪种风格？', sub: '这会用来匹配更合适的人。', items: STYLES }
    ];
    var s = steps[state.step] || steps[0];
    var dots = steps.map(function (_, i) {
      return '<i class="' + (i <= state.step ? 'on' : '') + '"></i>';
    }).join('');
    var canNext = !!state[s.key];
    return (
      '<section class="xl-wizard">' +
        '<div class="xl-progress">' + dots + '</div>' +
        '<div class="xl-kicker">第 ' + (state.step + 1) + ' 步，共 3 步</div>' +
        '<h1 class="xl-q">' + s.title + '</h1>' +
        '<p class="xl-q-sub">' + s.sub + '</p>' +
        '<div class="xl-opts">' + optionButtons(s.items, s.key) + '</div>' +
        '<div class="xl-wizard-nav">' +
          (state.step > 0 ? '<button class="xl-btn" type="button" id="xlPrev">上一步</button>' : '') +
          '<button class="xl-btn xl-btn-primary" type="button" id="xlNext"' + (canNext ? '' : ' disabled') + '>' +
            (state.step === 2 ? '查看匹配结果' : '下一步') +
          '</button>' +
          '<button class="xl-btn xl-btn-quiet" type="button" id="xlCasual">先随便看看</button>' +
        '</div>' +
      '</section>'
    );
  }

  function featureFooter(mentor, index, total) {
    return (
      '<div class="xh-ccard-actions">' +
        '<button class="xl-btn" type="button" id="xlNextCard">下一位</button>' +
        '<button class="xl-btn xl-btn-primary" type="button" id="xlPick">选择这位</button>' +
      '</div>' +
      '<p class="xh-ccard-counter">' + (index + 1) + ' / ' + total + '</p>' +
      '<div class="xh-ccard-peek"><img src="' + HERO + '" alt=""><span>一课一面</span></div>'
    );
  }

  function renderCards() {
    var api = cardApi();
    var list = state.list;
    var copy = api.matchCopy(state.mode, {
      grade: state.grade,
      subject: state.subject,
      style: state.style
    });
    var head = (
      '<div class="xl-match-head">' +
        '<div>' +
          '<div class="xl-kicker">' + copy.kicker + '</div>' +
          '<h1>' + copy.title + '</h1>' +
          '<p class="xl-summary">' + copy.summaryHtml + '</p>' +
        '</div>' +
        '<div class="xl-ctas">' +
          '<button class="xl-btn" type="button" id="xlAdjust">调整条件</button>' +
          (state.casual ? '<button class="xl-btn xl-btn-quiet" type="button" id="xlToIntake">改为按需匹配</button>' : '') +
        '</div>' +
      '</div>'
    );
    if (!list.length) {
      return '<section class="xl-match">' + head + '<p class="xl-empty">暂时没有可展示的学伴。</p></section>';
    }
    var current = list[state.index] || list[0];
    var feature = api.render(api.buildModel(current), {
      variant: 'feature',
      footerHtml: featureFooter(current, state.index, list.length)
    });
    var rows = list.map(function (item, i) {
      var model = api.buildModel(item);
      return api.render(model, {
        variant: 'row',
        className: i === state.index ? 'is-on' : '',
        footerHtml: '<button class="xl-btn" type="button" data-show="' + i + '">查看</button>'
      });
    }).join('');
    var picked = state.pickedNote
      ? '<div class="xl-picked">' + api.esc(state.pickedNote) + '</div>'
      : (state.pickedName
        ? '<div class="xl-picked">已选择 ' + api.esc(state.pickedName) + '。可继续登录或预约试讲。</div>'
        : '');
    return (
      '<section class="xl-match">' + head +
        '<div class="xl-board">' +
          feature +
          '<aside class="xl-list"><h3>本页可选择的学伴</h3>' + rows + picked + '</aside>' +
        '</div>' +
      '</section>'
    );
  }

  function render() {
    var app = document.getElementById('xhSelectApp');
    if (!app) return;
    if (state.loading && !state.matchLoaded && !state.casual) {
      app.innerHTML = '<p class="xl-empty">正在读取可选择的学伴…</p>';
      return;
    }
    app.innerHTML = state.view === 'cards' ? renderCards() : renderIntake();
    bind();
  }

  function bind() {
    var root = document.getElementById('xhSelectApp');
    if (!root) return;
    root.querySelectorAll('.xl-opt').forEach(function (btn) {
      btn.onclick = function () {
        state[btn.getAttribute('data-key')] = btn.getAttribute('data-val');
        render();
      };
    });
    var prev = document.getElementById('xlPrev');
    var next = document.getElementById('xlNext');
    var casual = document.getElementById('xlCasual');
    if (prev) prev.onclick = function () { state.step = Math.max(0, state.step - 1); render(); };
    if (next) next.onclick = function () {
      if (state.step < 2) { state.step += 1; render(); }
      else finishIntake();
    };
    if (casual) casual.onclick = function () { startCasual(); };
    var adjust = document.getElementById('xlAdjust');
    var toIntake = document.getElementById('xlToIntake');
    if (adjust) adjust.onclick = function () { startIntake(); };
    if (toIntake) toIntake.onclick = function () { startIntake(); };
    var pick = document.getElementById('xlPick');
    var nx = document.getElementById('xlNextCard');
    if (pick) pick.onclick = function () { continueWith(state.list[state.index]); };
    if (nx) nx.onclick = function () {
      if (!state.list.length) return;
      state.index = (state.index + 1) % state.list.length;
      render();
    };
    root.querySelectorAll('[data-show]').forEach(function (btn) {
      btn.onclick = function () {
        state.index = Number(btn.getAttribute('data-show')) || 0;
        render();
      };
    });
  }

  function showBrowse() {
    if (typeof global.showParentBrowseFlow === 'function') global.showParentBrowseFlow();
  }

  function startIntake() {
    state.view = 'intake';
    state.step = 0;
    state.casual = false;
    state.pickedName = '';
    state.pickedNote = '';
    render();
    showBrowse();
  }

  async function startCasual() {
    state.view = 'cards';
    state.casual = true;
    state.pickedName = '';
    state.pickedNote = '';
    state.loading = false;
    state.all = displayRoster();
    showBrowse();
    applyFilter();
    render();
  }

  async function finishIntake() {
    state.view = 'cards';
    state.casual = false;
    state.pickedName = '';
    state.pickedNote = '';
    showBrowse();
    if (!state.matchLoaded) {
      state.loading = true;
      render();
    }
    var list = await ensureMentors();
    state.all = list.slice();
    state.loaded = true;
    state.loading = false;
    applyFilter();
    render();
  }

  async function mountHomeTeaser() {
    var el = document.getElementById('xhHomeTeaser');
    if (!el) return;
    var list = await ensureMentors();
    var api = cardApi();
    var cards = list.slice(0, 3);
    if (!cards.length) {
      el.innerHTML = '<article class="xh-ccard xh-ccard-teaser c1"><p class="xh-ccard-school">暂时没有可展示的学伴。</p></article>';
      return;
    }
    var html = '';
    if (cards[2]) html += api.render(api.buildModel(cards[2]), { variant: 'teaser', className: 'c3' });
    if (cards[1]) html += api.render(api.buildModel(cards[1]), { variant: 'teaser', className: 'c2' });
    html += api.render(api.buildModel(cards[0]), { variant: 'teaser', className: 'c1' });
    el.innerHTML = html;
  }

  async function openFromQuery() {
    var q;
    try { q = new URLSearchParams(global.location.search || ''); }
    catch (e) { q = new URLSearchParams(); }
    state.grade = q.get('grade') || '';
    state.subject = q.get('subject') || '';
    state.style = q.get('style') || '';
    var step = q.get('step') || '';
    var casual = q.get('casual') === '1' || step === 'casual';
    if (q.get('resume') === '1' && q.get('pick')) {
      var pickedId = q.get('pick');
      var display = rosterEntry(pickedId);
      if (display) {
        continueWith(display);
        return;
      }
      await ensureMentors();
      state.all = state.matchList.slice();
      var mentor = null;
      state.all.forEach(function (m) { if (!mentor && String(m.id) === String(pickedId)) mentor = m; });
      continueWith(mentor || { id: pickedId });
      return;
    }
    if (casual) {
      state.casual = true;
      state.view = 'cards';
      state.all = displayRoster();
      state.loading = false;
      applyFilter();
      render();
      return;
    }
    await ensureMentors();
    state.all = state.matchList.slice();
    state.loaded = true;
    if (step === 'swipe' || step === 'cards' || (state.grade && state.subject)) {
      state.casual = false;
      state.view = 'cards';
      if (state.grade) state.step = state.subject ? (state.style ? 2 : 1) : 0;
      applyFilter();
      render();
      return;
    }
    state.view = 'intake';
    state.casual = false;
    render();
  }

  global.enterParentIntake = startIntake;
  global.enterParentCasual = function () { startCasual(); };

  global.SelectLanding = {
    startIntake: startIntake,
    startCasual: startCasual,
    mountHomeTeaser: mountHomeTeaser,
    openFromQuery: openFromQuery,
    render: render,
    GRADES: GRADES,
    SUBJECTS: SUBJECTS,
    STYLES: STYLES
  };
})(typeof window !== 'undefined' ? window : globalThis);
