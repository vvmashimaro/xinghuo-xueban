/**
 * 星火学伴 · 用户主控台顶栏 + 右侧 FAB 分区切换（Web）
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'xh_console_section';

  var PRESETS = {
    parent: [
      { id: 'courses', label: '我的课程', icon: 'fa-calendar-check' },
      { id: 'discover', label: '查找导师', icon: 'fa-magnifying-glass' },
      { id: 'account', label: '我的账户', icon: 'fa-wallet' }
    ],
    mentor: [
      { id: 'courses', label: '我的课程', icon: 'fa-inbox' },
      { id: 'workspace', label: '工作台', icon: 'fa-user-pen' },
      { id: 'account', label: '我的账户', icon: 'fa-wallet' }
    ]
  };

  function injectStyles() {
    if (document.getElementById('xh-console-nav-styles')) return;
    var style = document.createElement('style');
    style.id = 'xh-console-nav-styles';
    style.textContent =
      '.xh-console-bar{position:sticky;top:3.25rem;z-index:35;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(226,232,240,.9);}' +
      '.xh-console-bar-inner{max-width:80rem;margin:0 auto;padding:.35rem 1rem;display:flex;gap:.35rem;overflow-x:auto;}' +
      '.xh-console-tab{flex:1 0 auto;min-width:5.5rem;text-align:center;font-size:11px;font-weight:800;padding:.45rem .65rem;border-radius:.75rem;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;transition:all .15s;}' +
      '.xh-console-tab.on{background:#0d9488;color:#fff;border-color:#0d9488;box-shadow:0 4px 14px rgba(13,148,136,.25);}' +
      '.xh-console-pane.hidden{display:none!important;}' +
      '.xh-console-fab{position:fixed;right:1rem;bottom:1.25rem;z-index:850;width:3.25rem;height:3.25rem;border-radius:9999px;background:linear-gradient(145deg,#0f766e,#0d9488);color:#fff;font-size:1.35rem;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 28px rgba(13,148,136,.45);border:2px solid rgba(255,255,255,.35);cursor:pointer;}' +
      '.xh-console-fab:active{transform:scale(.96);opacity:.92;}' +
      '.xh-console-sheet-mask{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:860;}' +
      '.xh-console-sheet{position:fixed;left:0;right:0;bottom:0;z-index:870;background:#fff;border-radius:1.25rem 1.25rem 0 0;padding:1rem 1rem calc(1rem + env(safe-area-inset-bottom));box-shadow:0 -8px 32px rgba(15,23,42,.12);}' +
      '.xh-console-sheet button{width:100%;text-align:left;font-size:13px;font-weight:700;padding:.75rem 1rem;border-radius:.85rem;border:1px solid #e2e8f0;background:#f8fafc;margin-bottom:.5rem;cursor:pointer;}' +
      '.xh-console-sheet button.on{background:#ccfbf1;border-color:#14b8a6;color:#115e59;}';
    document.head.appendChild(style);
  }

  function readStored(role) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.role === role ? parsed.section : null;
    } catch (e) {
      return null;
    }
  }

  function storeSection(role, section) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: role, section: section }));
    } catch (e) {}
  }

  function UserConsoleNav(role, options) {
    this.role = role;
    this.tabs = (options && options.tabs) || PRESETS[role] || PRESETS.parent;
    this.onChange = options && options.onChange;
    this.current = readStored(role) || (this.tabs[0] && this.tabs[0].id) || 'courses';
    this._barEl = null;
    this._fabEl = null;
    this._sheet = null;
  }

  UserConsoleNav.prototype.mount = function () {
    injectStyles();
    var header = document.querySelector('header');
    if (!header) return;

    var bar = document.createElement('nav');
    bar.className = 'xh-console-bar';
    bar.setAttribute('aria-label', '主控台功能分区');
    var inner = document.createElement('div');
    inner.className = 'xh-console-bar-inner';
    this.tabs.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'xh-console-tab';
      btn.dataset.section = tab.id;
      btn.innerHTML = '<i class="fa-solid ' + tab.icon + ' mr-1"></i>' + tab.label;
      btn.addEventListener('click', function () {
        this.setSection(tab.id, true);
      }.bind(this));
      inner.appendChild(btn);
      this._tabButtons = this._tabButtons || {};
      this._tabButtons[tab.id] = btn;
    }.bind(this));
    bar.appendChild(inner);
    var matching = document.querySelector('[data-matching-banner]');
    var insertAfter = matching || header;
    insertAfter.insertAdjacentElement('afterend', bar);
    this._barEl = bar;

    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'xh-console-fab';
    fab.setAttribute('aria-label', '切换功能分区');
    fab.innerHTML = '<i class="fa-solid fa-bars"></i>';
    fab.addEventListener('click', function () {
      this.openSheet();
    }.bind(this));
    document.body.appendChild(fab);
    this._fabEl = fab;

    this.applySection(this.current, false);
  };

  UserConsoleNav.prototype.applySection = function (sectionId, persist) {
    var panes = document.querySelectorAll('[data-console-pane]');
    panes.forEach(function (el) {
      var match = el.getAttribute('data-console-pane') === sectionId;
      el.classList.toggle('hidden', !match);
    });
    if (this._tabButtons) {
      Object.keys(this._tabButtons).forEach(function (id) {
        this._tabButtons[id].classList.toggle('on', id === sectionId);
      }.bind(this));
    }
    this.current = sectionId;
    if (persist) storeSection(this.role, sectionId);
    if (typeof this.onChange === 'function') {
      this.onChange(sectionId);
    }
  };

  UserConsoleNav.prototype.setSection = function (sectionId, persist) {
    this.closeSheet();
    this.applySection(sectionId, persist !== false);
    var pane = document.querySelector('[data-console-pane="' + sectionId + '"]');
    if (pane && pane.scrollIntoView) {
      pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  UserConsoleNav.prototype.openSheet = function () {
    if (this._sheet) return;
    var mask = document.createElement('div');
    mask.className = 'xh-console-sheet-mask';
    var sheet = document.createElement('div');
    sheet.className = 'xh-console-sheet';
    var title = document.createElement('div');
    title.className = 'text-xs font-black text-slate-800 mb-2';
    title.textContent = '切换功能';
    sheet.appendChild(title);
    this.tabs.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = this.current === tab.id ? 'on' : '';
      btn.textContent = tab.label;
      btn.addEventListener('click', function () {
        this.setSection(tab.id, true);
      }.bind(this));
      sheet.appendChild(btn);
    }.bind(this));
    var settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.textContent = '更多设置（侧栏/档案）';
    settingsBtn.addEventListener('click', function () {
      this.closeSheet();
      if (this.role === 'parent' && typeof global.openPassportDrawer === 'function') {
        global.openPassportDrawer();
      } else if (typeof global.openMentorSettings === 'function') {
        global.openMentorSettings();
      }
    }.bind(this));
    sheet.appendChild(settingsBtn);
    mask.addEventListener('click', function () {
      this.closeSheet();
    }.bind(this));
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    this._sheet = { mask: mask, sheet: sheet };
  };

  UserConsoleNav.prototype.closeSheet = function () {
    if (!this._sheet) return;
    this._sheet.mask.remove();
    this._sheet.sheet.remove();
    this._sheet = null;
  };

  function init(role, options) {
    var nav = new UserConsoleNav(role, options || {});
    nav.mount();
    global.UserConsoleNav = nav;
    return nav;
  }

  global.UserConsoleNavInit = init;
})(typeof window !== 'undefined' ? window : global);
