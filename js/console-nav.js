/**
 * 星火学伴 · 用户主控台紧凑分段顶栏（Web）
 * 设置/档案入口收进「我的账户」，不再用 FAB 重复 Tab。
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
      '.xh-console-bar-inner{max-width:80rem;margin:0 auto;padding:.45rem 1rem;display:flex;justify-content:flex-start;align-items:center;overflow-x:auto;}' +
      '.xh-console-seg{display:inline-flex;align-items:center;gap:.2rem;padding:.2rem;border-radius:.9rem;background:#f1f5f9;border:1px solid #e2e8f0;}' +
      '.xh-console-tab{flex:0 0 auto;text-align:center;font-size:14px;font-weight:700;padding:.4rem .9rem;border-radius:.7rem;border:0;background:transparent;color:#475569;cursor:pointer;display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;transition:all .15s;}' +
      '.xh-console-tab.on{background:#0f766e;color:#fff;box-shadow:0 4px 14px rgba(15,118,110,.22);}' +
      '.xh-console-tab-badge{display:none;min-width:1.15rem;height:1.15rem;padding:0 .35rem;border-radius:9999px;font-size:12px;font-weight:800;line-height:1.15rem;background:#fbbf24;color:#0f172a;}' +
      '.xh-console-tab-badge.is-on{display:inline-flex;align-items:center;justify-content:center;}' +
      '.xh-console-tab.on .xh-console-tab-badge{background:#fde68a;color:#0f172a;}' +
      '.xh-console-tab-badge.is-muted{background:#ccfbf1;color:#0f766e;}' +
      '.xh-console-pane.hidden{display:none!important;}';
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
    this._tabButtons = {};
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
    var seg = document.createElement('div');
    seg.className = 'xh-console-seg';
    this.tabs.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'xh-console-tab';
      btn.dataset.section = tab.id;
      btn.innerHTML =
        '<i class="fa-solid ' + tab.icon + '"></i>' +
        '<span>' + tab.label + '</span>' +
        '<span class="xh-console-tab-badge" data-badge="' + tab.id + '"></span>';
      btn.addEventListener('click', function () {
        this.setSection(tab.id, true);
      }.bind(this));
      seg.appendChild(btn);
      this._tabButtons[tab.id] = btn;
    }.bind(this));
    inner.appendChild(seg);
    bar.appendChild(inner);
    var matching = document.querySelector('[data-matching-banner]');
    var insertAfter = matching || header;
    insertAfter.insertAdjacentElement('afterend', bar);
    this._barEl = bar;

    this.applySection(this.current, false);
  };

  UserConsoleNav.prototype.setTabBadge = function (sectionId, count, kind) {
    var btn = this._tabButtons[sectionId];
    if (!btn) return;
    var badge = btn.querySelector('[data-badge="' + sectionId + '"]');
    if (!badge) return;
    var n = Number(count) || 0;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.toggle('is-on', n > 0);
    badge.classList.toggle('is-muted', kind === 'muted' || kind === 'discover');
  };

  UserConsoleNav.prototype.applySection = function (sectionId, persist) {
    var panes = document.querySelectorAll('[data-console-pane]');
    panes.forEach(function (el) {
      var match = el.getAttribute('data-console-pane') === sectionId;
      el.classList.toggle('hidden', !match);
    });
    var fullBanner = document.querySelector('[data-matching-banner]');
    var compactBanner = document.querySelector('[data-matching-banner-compact]');
    var discover = sectionId === 'discover';
    if (fullBanner) {
      fullBanner.classList.toggle('is-compact', !discover);
      fullBanner.classList.toggle('hidden', !discover);
    }
    if (compactBanner) {
      var showCompact = !discover && sectionId === 'courses';
      compactBanner.classList.toggle('is-on', showCompact);
      compactBanner.classList.toggle('hidden', !showCompact);
    }
    Object.keys(this._tabButtons).forEach(function (id) {
      this._tabButtons[id].classList.toggle('on', id === sectionId);
    }.bind(this));
    this.current = sectionId;
    if (persist) storeSection(this.role, sectionId);
    if (typeof this.onChange === 'function') {
      this.onChange(sectionId);
    }
  };

  UserConsoleNav.prototype.setSection = function (sectionId, persist) {
    this.applySection(sectionId, persist !== false);
    var pane = document.querySelector('[data-console-pane="' + sectionId + '"]');
    if (pane && pane.scrollIntoView) {
      pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  function init(role, options) {
    var nav = new UserConsoleNav(role, options || {});
    nav.mount();
    global.UserConsoleNav = nav;
    return nav;
  }

  global.UserConsoleNavInit = init;
})(typeof window !== 'undefined' ? window : global);
