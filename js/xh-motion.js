/**
 * 星火学伴 · 全站动效层
 * 在 <head> 中同步加载：先给 <html> 打上 xh-motion，DOM 就绪后再绑定各效果。
 *
 * 声明式用法（加在 HTML 上即可）：
 *   data-xh-enter                首屏按文档顺序依次浮现
 *   data-xh-enter-children       子元素依次浮现
 *   data-xh-reveal               滚动进入视口时浮现
 *   data-xh-stagger="选择器"     容器内容变化时，匹配项依次浮现（默认直接子元素）
 *   data-xh-embers="light|dark"  背景漂浮星火（可加 data-xh-embers-layer="over" 叠在子元素上方）
 *   data-xh-tilt[="最大角度"]    3D 倾斜 + 高光（.xh-ccard 学伴卡自动启用）
 *   data-xh-spotlight            跟随鼠标的柔光
 *   data-xh-magnet               按钮被鼠标轻微吸引
 *   data-xh-trail                鼠标划过时留下火花
 *   data-xh-burst                点击迸发火花（深绿主按钮自动启用）
 *   data-xh-count                数字变化时滚动计数
 *   data-xh-celebrate            元素从隐藏变为显示时放一次烟花
 *   body[data-xh-progress]       顶部滚动进度条
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var root = doc.documentElement;
  var mq = function (q) { return !!(global.matchMedia && global.matchMedia(q).matches); };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var finePointer = mq('(hover: hover) and (pointer: fine)');
  var DPR = Math.min(global.devicePixelRatio || 1, 1.5);
  var raf = global.requestAnimationFrame || function (fn) { return setTimeout(function () { fn(Date.now()); }, 16); };

  var api = { enabled: !reduce };
  global.XHMotion = api;
  if (reduce) return;
  root.classList.add('xh-motion');

  var PALETTE = ['#f2b544', '#ffd27a', '#a6cd72', '#c5e6ae', '#2f8f6e'];
  var DARK_PALETTE = ['#f2b544', '#ffd98a', '#c5e6ae', '#a6cd72', '#ffffff'];
  var LIGHT_EMBERS = ['#f2a516', '#f5b83d', '#ffffff', '#8cc152', '#ffe08a'];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  var sprites = {};
  function glowSprite(color) {
    if (sprites[color]) return sprites[color];
    var c = doc.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, hexA(color, 0.35));
    grad.addColorStop(1, hexA(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites[color] = c;
    return c;
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function star(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0);
    }
    ctx.fill();
    ctx.restore();
  }

  /* ================= 全屏火花层（点击迸发 / 鼠标拖尾 / 庆祝） ================= */
  var overlay = null, octx = null, parts = [], running = false, lastT = 0;

  function ensureOverlay() {
    if (overlay) return;
    overlay = doc.createElement('canvas');
    overlay.className = 'xh-burst-canvas';
    overlay.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(overlay);
    octx = overlay.getContext('2d');
    sizeOverlay();
    global.addEventListener('resize', sizeOverlay);
  }
  function sizeOverlay() {
    overlay.width = Math.round(global.innerWidth * DPR);
    overlay.height = Math.round(global.innerHeight * DPR);
  }
  function spawn(p) {
    ensureOverlay();
    if (parts.length > 400) parts.shift();
    parts.push(p);
    if (!running) {
      running = true;
      lastT = 0;
      raf(loop);
    }
  }
  function loop(t) {
    var dt = lastT ? Math.min(3, (t - lastT) / 16.67) : 1;
    lastT = t;
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.vx *= Math.pow(p.drag, dt);
      p.vy = p.vy * Math.pow(p.drag, dt) + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      var k = 1 - p.age / p.life;
      octx.globalAlpha = Math.min(1, k * 1.6);
      if (p.star) {
        octx.fillStyle = p.color;
        star(octx, p.x, p.y, p.size * (0.6 + k * 0.6), p.rot);
      } else {
        var s = p.size * 3.2;
        octx.drawImage(glowSprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
      }
    }
    octx.globalAlpha = 1;
    if (parts.length) raf(loop);
    else {
      running = false;
      octx.clearRect(0, 0, overlay.width, overlay.height);
    }
  }

  api.burst = function (x, y, opts) {
    opts = opts || {};
    var n = opts.count || 18;
    var power = opts.power || 1;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      var sp = rand(2.2, 5.6) * power;
      spawn({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2 * power,
        g: 0.12, drag: 0.94,
        size: rand(2.2, 4.6) * (opts.scale || 1),
        star: Math.random() < 0.4,
        rot: rand(0, Math.PI), vr: rand(-0.15, 0.15),
        color: pick(opts.palette || PALETTE),
        age: 0, life: rand(38, 66)
      });
    }
  };

  api.celebrate = function () {
    var w = global.innerWidth, h = global.innerHeight;
    var shots = [[0.5, 0.35], [0.25, 0.42], [0.75, 0.4], [0.38, 0.25], [0.62, 0.28]];
    shots.forEach(function (s, i) {
      setTimeout(function () {
        api.burst(w * s[0], h * s[1], { count: 30, power: 1.5, scale: 1.2 });
      }, i * 170);
    });
  };

  function trailSpark(x, y) {
    spawn({
      x: x + rand(-4, 4), y: y + rand(-4, 4),
      vx: rand(-0.6, 0.6), vy: rand(-1.4, -0.4),
      g: -0.01, drag: 0.97,
      size: rand(1.4, 2.8),
      star: Math.random() < 0.3,
      rot: rand(0, Math.PI), vr: rand(-0.1, 0.1),
      color: pick(PALETTE),
      age: 0, life: rand(26, 44)
    });
  }

  /* ================= 背景漂浮星火 ================= */
  function Embers(host) {
    this.host = host;
    this.dark = host.getAttribute('data-xh-embers') === 'dark';
    this.density = parseFloat(host.getAttribute('data-xh-embers-density')) || 1;
    var cs = global.getComputedStyle(host);
    if (cs.position === 'static') host.style.position = 'relative';
    var canvas = doc.createElement('canvas');
    canvas.className = 'xh-embers-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    if (host.getAttribute('data-xh-embers-layer') === 'over') {
      canvas.style.zIndex = '1';
      host.appendChild(canvas);
    } else {
      host.style.isolation = 'isolate';
      canvas.style.zIndex = '-1';
      host.insertBefore(canvas, host.firstChild);
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.visible = true;
    this.pointer = null;
    this.last = 0;
    this.resize();
    var self = this;
    if (global.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(host);
    else global.addEventListener('resize', function () { self.resize(); });
    if (global.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        self.visible = es[0].isIntersecting;
        if (self.visible) self.start();
      }).observe(host);
    }
    global.addEventListener('pointermove', function (e) {
      var r = self.rect;
      if (!r) return;
      var x = e.clientX - r.left, y = e.clientY - r.top;
      self.pointer = x >= 0 && y >= 0 && x <= r.width && y <= r.height ? { x: x, y: y } : null;
    }, { passive: true });
    global.addEventListener('scroll', function () { self.rect = self.host.getBoundingClientRect(); }, { passive: true });
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) self.start(); });
    this.start();
  }
  Embers.prototype.resize = function () {
    var r = this.host.getBoundingClientRect();
    this.rect = r;
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * DPR);
    this.canvas.height = Math.round(this.h * DPR);
    var target = Math.round(Math.max(10, Math.min(70, (this.w * this.h) / 15000)) * this.density);
    while (this.items.length < target) this.items.push(this.make(true));
    this.items.length = target;
  };
  Embers.prototype.make = function (anywhere) {
    return {
      x: rand(0, this.w),
      y: anywhere ? rand(0, this.h) : this.h + rand(4, 30),
      r: this.dark ? rand(0.7, 2.3) : rand(1.6, 4),
      vy: rand(0.12, 0.45),
      sway: rand(6, 22),
      phase: rand(0, Math.PI * 2),
      tw: rand(0.01, 0.035),
      star: Math.random() < 0.14,
      color: pick(this.dark ? DARK_PALETTE : LIGHT_EMBERS),
      ox: 0, oy: 0
    };
  };
  Embers.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    var self = this;
    raf(function step(t) { self.frame(t, step); });
  };
  Embers.prototype.frame = function (t, step) {
    if (!this.visible || doc.hidden || !this.host.isConnected) { this.running = false; return; }
    var dt = this.last ? Math.min(3, (t - this.last) / 16.67) : 1;
    this.last = t;
    var ctx = this.ctx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = this.dark ? 'lighter' : 'source-over';
    var p = this.pointer;
    for (var i = 0; i < this.items.length; i++) {
      var e = this.items[i];
      e.phase += e.tw * dt;
      e.y -= e.vy * dt;
      if (e.y < -20) { this.items[i] = e = this.make(false); }
      var x = e.x + Math.sin(e.phase) * e.sway;
      if (p) {
        var dx = x + e.ox - p.x, dy = e.y + e.oy - p.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 12000) {
          var f = (1 - d2 / 12000) * 2.2;
          var d = Math.sqrt(d2) || 1;
          e.ox += (dx / d) * f * dt;
          e.oy += (dy / d) * f * dt;
        }
      }
      e.ox *= 0.96;
      e.oy *= 0.96;
      var a = 0.35 + 0.65 * Math.abs(Math.sin(e.phase * 1.7));
      var edge = Math.min(1, e.y / 60, (this.h - e.y) / 30 + 0.4);
      ctx.globalAlpha = Math.max(0, a * edge);
      if (e.star) {
        ctx.fillStyle = e.color;
        star(ctx, x + e.ox, e.y + e.oy, e.r * 2.6, e.phase * 0.3);
      } else {
        var s = e.r * 4;
        ctx.drawImage(glowSprite(e.color), x + e.ox - s, e.y + e.oy - s, s * 2, s * 2);
      }
    }
    ctx.globalAlpha = 1;
    raf(step);
  };
  api.embers = function (host) {
    if (!host || host._xhEmbers) return host && host._xhEmbers;
    host._xhEmbers = new Embers(host);
    return host._xhEmbers;
  };

  /* ================= 点击：涟漪 + 火花 ================= */
  function parseRGB(str) {
    var m = /rgba?\(([^)]+)\)/.exec(str || '');
    if (!m) return null;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function bgOf(el) {
    var c = parseRGB(global.getComputedStyle(el).backgroundColor);
    return c && c.a > 0.4 ? c : null;
  }
  function lum(c) { return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255; }
  function isBrand(c) { return !!c && c.g > c.r * 1.15 && c.g >= c.b * 0.95 && lum(c) < 0.45; }

  var CLICKABLE = 'button, [role="button"], .xl-btn, .xl-opt';

  function ripple(el, e, bg) {
    if (global.getComputedStyle(el).position === 'static') el.classList.add('xh-ripple-host');
    var clip = null;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].classList.contains('xh-ripple-clip')) { clip = el.children[i]; break; }
    }
    if (!clip) {
      clip = doc.createElement('span');
      clip.className = 'xh-ripple-clip';
      clip.setAttribute('aria-hidden', 'true');
      el.appendChild(clip);
    }
    var r = el.getBoundingClientRect();
    var size = Math.max(r.width, r.height) * 2.2;
    var s = doc.createElement('span');
    s.className = 'xh-ripple';
    s.style.width = s.style.height = size + 'px';
    s.style.left = e.clientX - r.left - size / 2 + 'px';
    s.style.top = e.clientY - r.top - size / 2 + 'px';
    s.style.background = lum(bg) < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(22,107,86,0.35)';
    clip.appendChild(s);
    setTimeout(function () { s.remove(); }, 650);
  }

  function bindClicks() {
    doc.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !e.target.closest) return;
      var el = e.target.closest(CLICKABLE);
      if (!el || el.disabled || el.closest('[data-xh-no-ripple]')) return;
      var bg = bgOf(el);
      if (bg) ripple(el, e, bg);
    }, { passive: true, capture: true });

    doc.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var el = e.target.closest('[data-xh-burst], ' + CLICKABLE);
      if (!el || el.disabled || el.closest('[data-xh-no-burst]')) return;
      if (!el.hasAttribute('data-xh-burst') && !isBrand(bgOf(el))) return;
      var r = el.getBoundingClientRect();
      var big = r.width >= 150;
      var x = e.clientX || r.left + r.width / 2;
      var y = e.clientY || r.top + r.height / 2;
      api.burst(x, y, big ? { count: 22, power: 1 } : { count: 10, power: 0.6, scale: 0.8 });
    }, true);
  }

  /* ================= 指针驱动：倾斜 / 柔光 / 磁吸 / 拖尾 ================= */
  var TILT_SEL = '[data-xh-tilt], .xh-ccard:not(.xh-ccard-row):not(.xh-ccard-host):not(.xh-ccard-live)';

  function prepTilt(el) {
    if (!el.classList.contains('xh-tilt')) {
      el.classList.add('xh-tilt');
      if (global.getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var parent = el.parentElement;
      if (parent && global.getComputedStyle(parent).perspective === 'none') parent.style.perspective = '1100px';
    }
    var hasGlare = false;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].classList.contains('xh-glare')) { hasGlare = true; break; }
    }
    if (!hasGlare) {
      var g = doc.createElement('span');
      g.className = 'xh-glare';
      g.setAttribute('aria-hidden', 'true');
      el.appendChild(g);
    }
  }
  function untilt(el) {
    el.classList.remove('is-tilting');
    el.style.rotate = '';
  }

  function bindPointer() {
    var tiltEl = null;
    var magnetEls = [];
    var lastTrail = { x: 0, y: 0, t: 0 };

    doc.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var t = e.target.closest ? e.target : null;
      if (!t) return;

      var el = t.closest(TILT_SEL);
      if (el !== tiltEl) {
        if (tiltEl) untilt(tiltEl);
        tiltEl = el;
      }
      if (el) {
        prepTilt(el);
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        var max = parseFloat(el.getAttribute('data-xh-tilt')) || Math.max(3, Math.min(10, 2600 / r.width));
        var ax = 0.5 - py, ay = px - 0.5;
        var ang = Math.sqrt(ax * ax + ay * ay) * 2 * max;
        el.style.rotate = ang > 0.05 ? ax.toFixed(3) + ' ' + ay.toFixed(3) + ' 0 ' + ang.toFixed(2) + 'deg' : '';
        el.style.setProperty('--xh-gx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--xh-gy', (py * 100).toFixed(1) + '%');
        el.classList.add('is-tilting');
      }

      var spot = t.closest('[data-xh-spotlight]');
      if (spot) {
        var sr = spot.getBoundingClientRect();
        spot.style.setProperty('--xh-mx', (e.clientX - sr.left).toFixed(0) + 'px');
        spot.style.setProperty('--xh-my', (e.clientY - sr.top).toFixed(0) + 'px');
      }

      magnetEls.forEach(function (m) {
        var mr = m.getBoundingClientRect();
        var cx = mr.left + mr.width / 2, cy = mr.top + mr.height / 2;
        var dx = e.clientX - cx, dy = e.clientY - cy;
        var reach = Math.max(mr.width, mr.height) * 0.9;
        if (Math.abs(dx) < reach && Math.abs(dy) < reach) {
          m.style.translate = (dx * 0.12).toFixed(1) + 'px ' + (dy * 0.18).toFixed(1) + 'px';
        } else if (m.style.translate) {
          m.style.translate = '';
        }
      });

      if (t.closest('[data-xh-trail]')) {
        var now = e.timeStamp || Date.now();
        var mdx = e.clientX - lastTrail.x, mdy = e.clientY - lastTrail.y;
        if (now - lastTrail.t > 28 && mdx * mdx + mdy * mdy > 160) {
          trailSpark(e.clientX, e.clientY);
          lastTrail = { x: e.clientX, y: e.clientY, t: now };
        }
      }
    }, { passive: true });

    root.addEventListener('mouseleave', function () {
      if (tiltEl) untilt(tiltEl);
      tiltEl = null;
      magnetEls.forEach(function (m) { m.style.translate = ''; });
    });

    api._registerMagnet = function (el) {
      if (magnetEls.indexOf(el) < 0) magnetEls.push(el);
    };
  }

  /* ================= 入场 / 滚动浮现 / 列表依次出现 ================= */
  function applyEnter() {
    var list = doc.querySelectorAll('[data-xh-enter], [data-xh-enter-children] > *');
    var n = 0;
    Array.prototype.forEach.call(list, function (el) {
      if (!el.hasAttribute('data-xh-enter')) el.setAttribute('data-xh-enter', '');
      var base = parseInt(el.getAttribute('data-xh-enter'), 10);
      el.style.setProperty('--xh-d', (isNaN(base) ? 60 + Math.min(n, 14) * 85 : base) + 'ms');
      n++;
    });
  }

  var revealIO = null;
  function watchReveal(el, delay) {
    if (el._xhReveal) return;
    el._xhReveal = true;
    var r = el.getBoundingClientRect();
    if (r.top < global.innerHeight * 0.92) return;
    if (!global.IntersectionObserver) return;
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('xh-reveal-on');
          en.target.classList.remove('xh-reveal-wait');
          revealIO.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -8% 0px' });
    }
    if (delay) el.style.setProperty('--xh-d', delay + 'ms');
    el.classList.add('xh-reveal-wait');
    revealIO.observe(el);
  }
  function applyReveal(scope) {
    Array.prototype.forEach.call((scope || doc).querySelectorAll('[data-xh-reveal]'), function (el) { watchReveal(el, 0); });
    Array.prototype.forEach.call((scope || doc).querySelectorAll('[data-xh-reveal-children]'), function (box) {
      Array.prototype.forEach.call(box.children, function (c, i) { watchReveal(c, (i % 4) * 90); });
    });
  }

  function watchStagger(box) {
    if (box._xhStagger) return;
    box._xhStagger = true;
    var sel = box.getAttribute('data-xh-stagger');
    var lastSig = null;
    var timer = 0;
    function items() {
      if (sel) return Array.prototype.slice.call(box.querySelectorAll(sel));
      return Array.prototype.slice.call(box.children);
    }
    function run() {
      timer = 0;
      var list = items().filter(function (n) { return n.offsetParent !== null || n === doc.body; });
      var sig = list.map(function (n) { return (n.textContent || '').replace(/\s+/g, '').slice(0, 60); }).join('|');
      if (sig === lastSig) return;
      var first = lastSig === null;
      lastSig = sig;
      if (first && box.hasAttribute('data-xh-stagger-skip-first')) return;
      list.forEach(function (n, i) {
        if (i > 14) return;
        n.classList.remove('xh-in');
        void n.offsetWidth;
        n.style.setProperty('--xh-d', i * 50 + 'ms');
        n.classList.add('xh-in');
      });
    }
    new MutationObserver(function () {
      if (!timer) timer = setTimeout(run, 24);
    }).observe(box, { childList: true, subtree: true });
    run();
  }

  /* ================= 数字滚动 ================= */
  function animateCount(el, from, to) {
    var start = 0, dur = Math.min(1400, 500 + Math.abs(to - from) * 12);
    var written = null;
    el._xhCounting = true;
    raf(function tick(t) {
      if (written !== null && el.textContent !== written) {
        el._xhCounting = false;
        el._xhCheck();
        return;
      }
      if (!start) start = t;
      var k = Math.min(1, (t - start) / dur);
      var v = from + (to - from) * (1 - Math.pow(1 - k, 3));
      written = String(k < 1 ? Math.round(v) : to);
      el.textContent = written;
      if (k < 1) raf(tick);
      else el._xhCounting = false;
    });
  }
  function watchCount(el) {
    if (el._xhCount) return;
    el._xhCount = true;
    var prev = 0;
    el._xhCheck = check;
    function check() {
      if (el._xhCounting) return;
      var txt = (el.textContent || '').trim();
      if (!/^\d{1,6}$/.test(txt)) return;
      var v = parseInt(txt, 10);
      if (v !== prev) {
        var from = prev;
        prev = v;
        animateCount(el, from, v);
      }
    }
    new MutationObserver(check).observe(el, { childList: true, characterData: true, subtree: true });
    check();
  }

  /* ================= 庆祝 ================= */
  function watchCelebrate(el) {
    if (el._xhCelebrate) return;
    el._xhCelebrate = true;
    var shown = !el.classList.contains('hidden') && el.offsetParent !== null;
    new MutationObserver(function () {
      var now = !el.classList.contains('hidden') && global.getComputedStyle(el).display !== 'none';
      if (now && !shown) setTimeout(api.celebrate, 120);
      shown = now;
    }).observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  /* ================= 扫描与挂载 ================= */
  function scan(scope) {
    var q = function (s) { return (scope || doc).querySelectorAll(s); };
    Array.prototype.forEach.call(q('[data-xh-embers]'), function (el) { api.embers(el); });
    Array.prototype.forEach.call(q('[data-xh-stagger]'), watchStagger);
    Array.prototype.forEach.call(q('[data-xh-count]'), watchCount);
    Array.prototype.forEach.call(q('[data-xh-celebrate]'), watchCelebrate);
    if (finePointer) Array.prototype.forEach.call(q('[data-xh-magnet]'), function (el) { api._registerMagnet(el); });
    applyReveal(scope);
  }

  function init() {
    applyEnter();
    bindClicks();
    if (finePointer) bindPointer();
    else api._registerMagnet = function () {};
    scan(doc);
    if (doc.body.hasAttribute('data-xh-progress')) {
      var bar = doc.createElement('div');
      bar.className = 'xh-scroll-progress';
      bar.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(bar);
    }
    var pending = [];
    var scheduled = false;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) pending.push(n); });
      });
      if (pending.length && !scheduled) {
        scheduled = true;
        setTimeout(function () {
          scheduled = false;
          var nodes = pending.splice(0);
          nodes.forEach(function (n) {
            if (!n.isConnected || n.classList.contains('xh-ripple') || n.classList.contains('xh-ripple-clip') || n.classList.contains('xh-glare')) return;
            if (n.matches('[data-xh-embers],[data-xh-stagger],[data-xh-count],[data-xh-celebrate],[data-xh-reveal],[data-xh-magnet]')) scan(n.parentNode || doc);
            else if (n.querySelector && n.querySelector('[data-xh-embers],[data-xh-stagger],[data-xh-count],[data-xh-celebrate],[data-xh-reveal],[data-xh-magnet]')) scan(n);
          });
        }, 30);
      }
    }).observe(doc.body, { childList: true, subtree: true });
  }

  api.refresh = function (scope) { scan(scope || doc); };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : this);
