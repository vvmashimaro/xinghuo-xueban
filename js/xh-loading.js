/**
 * 星火学伴 · Web 全局 API 等待层（SVG 星标，轻微脉冲）
 * 包装 window.fetch：仅跟踪同源 /api/*；轮询与开关接口静默。
 */
(function (global) {
  'use strict';

  var pending = 0;
  var showTimer = null;
  var DELAY_MS = 160;
  var SVG_NAME = 'xinghuo-loading.svg';
  var CSS_NAME = 'xinghuo-loading-overlay.css';

  function assetUrl(name) {
    try {
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].getAttribute('src') || '';
        if (src.indexOf('xh-loading.js') >= 0) {
          return src.replace(/js\/xh-loading\.js(\?.*)?$/, 'assets/loading/' + name);
        }
      }
    } catch (e) {}
    return 'assets/loading/' + name;
  }

  function ensureDom() {
    if (document.getElementById('xhLoading')) return;
    if (!document.head || !document.body) return;
    if (!document.getElementById('xhLoadingCss')) {
      var link = document.createElement('link');
      link.id = 'xhLoadingCss';
      link.rel = 'stylesheet';
      link.href = assetUrl(CSS_NAME);
      document.head.appendChild(link);
    }
    var wrap = document.createElement('div');
    wrap.id = 'xhLoading';
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-busy', 'false');
    wrap.innerHTML =
      '<div class="xh-logo-wrap">' +
        '<img class="xh-logo" alt="" width="72" height="72" src="' + assetUrl(SVG_NAME) + '">' +
      '</div>' +
      '<div class="xh-tip">正在连接服务…</div>';
    document.body.appendChild(wrap);
  }

  function isAuthQuietUi() {
    try {
      if (document.documentElement.getAttribute('data-xh-auth-ui') === '1') return true;
      var p = String(global.location && global.location.pathname || '');
      return /login\.html$/i.test(p);
    } catch (e) {
      return false;
    }
  }

  function show() {
    if (isAuthQuietUi()) return;
    ensureDom();
    var el = document.getElementById('xhLoading');
    if (!el) return;
    el.classList.add('show');
    el.setAttribute('aria-busy', 'true');
  }

  function hide() {
    var el = document.getElementById('xhLoading');
    if (!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-busy', 'false');
  }

  function begin() {
    pending += 1;
    if (pending === 1 && !showTimer) {
      showTimer = setTimeout(function () {
        showTimer = null;
        if (pending > 0) show();
      }, DELAY_MS);
    }
  }

  function end() {
    pending = Math.max(0, pending - 1);
    if (pending === 0) {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      hide();
    }
  }

  function shouldTrack(url) {
    var u = String(url || '');
    if (!u) return false;
    if (u.indexOf('/api/') < 0) return false;
    if (u.indexOf('/api/pay/wechat/sync') >= 0) return false;
    if (u.indexOf('/api/feature-flags') >= 0) return false;
    if (u.indexOf('/api/health') >= 0) return false;
    return true;
  }

  function wrapFetch() {
    if (!global.fetch || global.fetch.__xhLoadingWrapped) return;
    var orig = global.fetch.bind(global);
    function wrapped(input, init) {
      var url = '';
      try {
        url = typeof input === 'string' ? input : (input && input.url) || '';
      } catch (e) {}
      var track = shouldTrack(url);
      if (track) begin();
      var p = orig(input, init);
      if (!track) return p;
      return Promise.resolve(p).then(
        function (res) {
          end();
          return res;
        },
        function (err) {
          end();
          throw err;
        }
      );
    }
    wrapped.__xhLoadingWrapped = true;
    global.fetch = wrapped;
  }

  function boot() {
    wrapFetch();
    if (document.body) ensureDom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  wrapFetch();

  global.XHLoading = {
    begin: begin,
    end: end,
    shouldTrack: shouldTrack
  };
})(typeof window !== 'undefined' ? window : this);
