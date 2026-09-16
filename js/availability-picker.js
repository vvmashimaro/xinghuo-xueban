/**
 * 星火学伴 · 可约时段选择器
 * 以周为循环：先勾选周几 → 再仅为当天拖选半小时格；与 StorageService 可用性模型互通。
 */
(function (global) {
  'use strict';

  var WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 周一…周日
  var WEEKDAY_SHORT = { 0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
  var GRID_START = 8;  // 08:00
  var GRID_END = 22;   // 22:00
  var SLOT_MIN = 30;

  function pad(n) { return String(n).padStart(2, '0'); }

  function minutesToLabel(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return pad(h) + ':' + pad(m);
  }

  function labelToMinutes(label) {
    var parts = String(label || '00:00').split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }

  function buildSlotLabels() {
    var labels = [];
    for (var m = GRID_START * 60; m < GRID_END * 60; m += SLOT_MIN) {
      labels.push(minutesToLabel(m));
    }
    return labels;
  }

  function rangesFromSelected(selectedSet) {
    var labels = buildSlotLabels();
    var ranges = [];
    var i = 0;
    while (i < labels.length) {
      if (!selectedSet[labels[i]]) { i += 1; continue; }
      var start = labels[i];
      while (i < labels.length && selectedSet[labels[i]]) i += 1;
      var endMins = labelToMinutes(labels[i - 1]) + SLOT_MIN;
      ranges.push({ start: start, end: minutesToLabel(endMins) });
    }
    return ranges;
  }

  function selectedFromRanges(ranges) {
    var set = {};
    (ranges || []).forEach(function (r) {
      var a = labelToMinutes(r.start);
      var b = labelToMinutes(r.end);
      for (var m = a; m < b; m += SLOT_MIN) {
        set[minutesToLabel(m)] = true;
      }
    });
    return set;
  }

  function normalizeAvailability(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (item) {
      return {
        weekday: parseInt(item.weekday, 10),
        ranges: (item.ranges || []).map(function (r) {
          return { start: r.start, end: r.end };
        }).filter(function (r) { return r.start && r.end; })
      };
    }).filter(function (item) {
      return !isNaN(item.weekday) && item.ranges.length;
    });
  }

  /**
   * Mount picker into containerEl.
   * options: { value, onChange }
   * value: [{ weekday, ranges:[{start,end}] }]
   */
  function mount(containerEl, options) {
    if (!containerEl) return null;
    var opts = options || {};
    var state = {
      byDay: {}, // weekday -> { '19:00': true, ... }
      activeDay: null,
      dragging: false,
      dragMode: true, // true=select, false=deselect
      dragStartIdx: -1,
      _checked: {}
    };

    WEEKDAY_ORDER.forEach(function (wd) { state.byDay[wd] = {}; });
    normalizeAvailability(opts.value || []).forEach(function (item) {
      state.byDay[item.weekday] = selectedFromRanges(item.ranges);
      state._checked[item.weekday] = true;
      if (state.activeDay == null) state.activeDay = item.weekday;
    });
    if (state.activeDay == null) state.activeDay = 1;

    var slotLabels = buildSlotLabels();

    function emit() {
      if (typeof opts.onChange !== 'function') return;
      opts.onChange(getValue());
    }

    function getValue() {
      var out = [];
      WEEKDAY_ORDER.forEach(function (wd) {
        if (!state._checked[wd]) return;
        var ranges = rangesFromSelected(state.byDay[wd] || {});
        if (ranges.length) out.push({ weekday: wd, ranges: ranges });
      });
      return out;
    }

    function uncheckDay(wd) {
      state._checked[wd] = false;
      state.byDay[wd] = {};
      if (state.activeDay === wd) {
        var next = WEEKDAY_ORDER.find(function (d) { return state._checked[d]; });
        state.activeDay = next != null ? next : wd;
      }
    }

    function render() {
      var checked = state._checked;
      var daysHtml = WEEKDAY_ORDER.map(function (wd) {
        var on = !!checked[wd];
        var active = state.activeDay === wd;
        var boxCls = on
          ? (active
            ? 'bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-300/60'
            : 'bg-teal-50 text-teal-800 border-teal-300')
          : 'bg-white text-slate-500 border-slate-200';
        return '<button type="button" data-wd="' + wd + '" class="avail-wd-btn inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold px-2.5 py-1.5 rounded-xl border transition cursor-pointer select-none ' + boxCls + '">' +
          '<span class="inline-flex w-3.5 h-3.5 rounded border ' + (on ? (active ? 'bg-white border-white text-teal-700' : 'bg-teal-600 border-teal-600 text-white') : 'bg-white border-slate-300') + ' items-center justify-center text-[8px] leading-none">' +
            (on ? '✓' : '') +
          '</span>' +
          '<span>周' + WEEKDAY_SHORT[wd] + '</span></button>';
      }).join('');

      var activeOn = !!checked[state.activeDay];
      var activeLabel = '周' + WEEKDAY_SHORT[state.activeDay];
      var gridHtml = '';
      if (!activeOn) {
        gridHtml =
          '<div class="text-[11px] text-slate-400 py-6 text-center leading-relaxed">' +
            '请先在上方勾选可约的周几<br>' +
            '<span class="text-slate-500">仅在已勾选并选中的日期下显示半小时拖选格</span>' +
          '</div>';
      } else {
        var sel = state.byDay[state.activeDay] || {};
        var rangeText = rangesFromSelected(sel).map(function (r) { return r.start + '-' + r.end; }).join('、') || '未选时段';
        gridHtml =
          '<div class="flex flex-wrap items-center justify-between gap-2 mb-2">' +
            '<div class="text-[11px] font-bold text-teal-900">' +
              '正在设置：' + activeLabel +
              ' <span class="font-normal text-slate-500">（仅影响当天）</span>' +
            '</div>' +
            '<button type="button" class="avail-uncheck-day text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg cursor-pointer">取消勾选' + activeLabel + '</button>' +
          '</div>' +
          '<div class="avail-grid grid grid-cols-4 sm:grid-cols-6 gap-1 select-none" data-day="' + state.activeDay + '">' +
            slotLabels.map(function (lab, idx) {
              var on = !!sel[lab];
              var cellCls = on
                ? 'bg-teal-500 text-white border-teal-600'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-teal-300';
              return '<div class="avail-cell text-[10px] font-mono text-center py-1.5 rounded-lg border cursor-pointer transition ' + cellCls + '" data-idx="' + idx + '" data-label="' + lab + '">' + lab + '</div>';
            }).join('') +
          '</div>' +
          '<p class="text-[10px] text-slate-400 mt-1.5">拖拽勾选/取消半小时格 · ' + activeLabel + '已选：' + rangeText + '</p>';
      }

      var summary = getValue().map(function (item) {
        var ranges = item.ranges.map(function (r) { return r.start + '-' + r.end; }).join('、');
        return '周' + WEEKDAY_SHORT[item.weekday] + ' ' + ranges;
      }).join(' · ') || '尚未设置可约时段';

      var checkedCount = WEEKDAY_ORDER.filter(function (wd) { return checked[wd]; }).length;

      containerEl.innerHTML =
        '<div class="rounded-2xl border border-teal-100 bg-teal-50/40 p-3 sm:p-4 space-y-3">' +
          '<div class="flex items-start justify-between gap-2">' +
            '<div>' +
              '<div class="text-xs font-bold text-teal-900 flex items-center gap-1.5"><i class="fa-regular fa-calendar-check text-teal-600"></i>可约时段 · 以周为循环</div>' +
              '<p class="text-[10px] text-slate-500 mt-0.5">每周重复同一套规则：勾选周几 → 再为<strong class="text-teal-800">当天</strong>拖选半小时格（08:00–22:00）</p>' +
            '</div>' +
            '<button type="button" class="avail-clear text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer shrink-0">清空全部</button>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">' +
              '<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal-600 text-white text-[9px]">①</span>' +
              '选择每周哪几天可约' +
              '<span class="font-normal text-slate-400">（已勾选 ' + checkedCount + ' 天）</span>' +
            '</div>' +
            '<div class="flex flex-wrap gap-1.5">' + daysHtml + '</div>' +
            '<p class="text-[10px] text-slate-400 mt-1.5">点击周几：勾选并进入该日；已勾选的切换芯片可查看/编辑当日时段</p>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">' +
              '<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal-600 text-white text-[9px]">②</span>' +
              '为当天拖选时段（半小时）' +
            '</div>' +
            '<div class="bg-white/80 rounded-xl border border-teal-100/80 p-2 sm:p-2.5">' + gridHtml + '</div>' +
          '</div>' +
          '<div class="text-[10px] text-teal-800 bg-white/70 border border-teal-100 rounded-xl px-2.5 py-1.5 leading-relaxed">' +
            '<span class="font-bold">每周循环已设：</span>' + summary +
          '</div>' +
        '</div>';

      // weekday chips: click checks+activates; if already checked, only focus (no accidental uncheck)
      Array.prototype.forEach.call(containerEl.querySelectorAll('.avail-wd-btn'), function (btn) {
        btn.addEventListener('click', function () {
          var wd = parseInt(btn.getAttribute('data-wd'), 10);
          if (!checked[wd]) {
            checked[wd] = true;
            state.activeDay = wd;
          } else {
            state.activeDay = wd;
          }
          render();
          emit();
        });
      });

      var uncheckBtn = containerEl.querySelector('.avail-uncheck-day');
      if (uncheckBtn) {
        uncheckBtn.addEventListener('click', function () {
          uncheckDay(state.activeDay);
          render();
          emit();
        });
      }

      var clearBtn = containerEl.querySelector('.avail-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          WEEKDAY_ORDER.forEach(function (wd) {
            state.byDay[wd] = {};
            state._checked[wd] = false;
          });
          state.activeDay = 1;
          render();
          emit();
        });
      }

      var grid = containerEl.querySelector('.avail-grid');
      if (grid) {
        var day = parseInt(grid.getAttribute('data-day'), 10);
        function applyDrag(fromIdx, toIdx) {
          var a = Math.min(fromIdx, toIdx);
          var b = Math.max(fromIdx, toIdx);
          if (!state.byDay[day]) state.byDay[day] = {};
          for (var i = a; i <= b; i++) {
            var lab = slotLabels[i];
            if (state.dragMode) state.byDay[day][lab] = true;
            else delete state.byDay[day][lab];
          }
          Array.prototype.forEach.call(grid.querySelectorAll('.avail-cell'), function (cell) {
            var idx = parseInt(cell.getAttribute('data-idx'), 10);
            var lab = slotLabels[idx];
            var on = !!state.byDay[day][lab];
            cell.className = 'avail-cell text-[10px] font-mono text-center py-1.5 rounded-lg border cursor-pointer transition ' +
              (on ? 'bg-teal-500 text-white border-teal-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-teal-300');
          });
        }

        function onPointerDown(e) {
          var cell = e.target.closest('.avail-cell');
          if (!cell) return;
          e.preventDefault();
          state.dragging = true;
          var idx = parseInt(cell.getAttribute('data-idx'), 10);
          var lab = slotLabels[idx];
          state.dragMode = !state.byDay[day][lab];
          state.dragStartIdx = idx;
          applyDrag(idx, idx);
        }
        function onPointerEnter(e) {
          if (!state.dragging) return;
          var cell = e.target.closest('.avail-cell');
          if (!cell) return;
          var idx = parseInt(cell.getAttribute('data-idx'), 10);
          applyDrag(state.dragStartIdx, idx);
        }
        function onPointerUp() {
          if (!state.dragging) return;
          state.dragging = false;
          render();
          emit();
        }

        grid.addEventListener('mousedown', onPointerDown);
        grid.addEventListener('mouseover', onPointerEnter);
        document.addEventListener('mouseup', onPointerUp);
        grid.addEventListener('touchstart', function (e) {
          var cell = e.target.closest('.avail-cell');
          if (!cell) return;
          e.preventDefault();
          state.dragging = true;
          var idx = parseInt(cell.getAttribute('data-idx'), 10);
          var lab = slotLabels[idx];
          state.dragMode = !state.byDay[day][lab];
          state.dragStartIdx = idx;
          applyDrag(idx, idx);
        }, { passive: false });
        grid.addEventListener('touchmove', function (e) {
          if (!state.dragging) return;
          var t = e.touches[0];
          var el = document.elementFromPoint(t.clientX, t.clientY);
          var cell = el && el.closest ? el.closest('.avail-cell') : null;
          if (!cell || !grid.contains(cell)) return;
          var idx = parseInt(cell.getAttribute('data-idx'), 10);
          applyDrag(state.dragStartIdx, idx);
        }, { passive: false });
        grid.addEventListener('touchend', onPointerUp);

        state._onPointerUp = onPointerUp;
      }
    }

    render();

    return {
      getValue: getValue,
      setValue: function (list) {
        WEEKDAY_ORDER.forEach(function (wd) {
          state.byDay[wd] = {};
          state._checked[wd] = false;
        });
        state.activeDay = null;
        normalizeAvailability(list || []).forEach(function (item) {
          state.byDay[item.weekday] = selectedFromRanges(item.ranges);
          state._checked[item.weekday] = true;
          if (state.activeDay == null) state.activeDay = item.weekday;
        });
        if (state.activeDay == null) state.activeDay = 1;
        render();
      },
      destroy: function () {
        if (state._onPointerUp) document.removeEventListener('mouseup', state._onPointerUp);
        containerEl.innerHTML = '';
      }
    };
  }

  global.AvailabilityPicker = {
    mount: mount,
    normalize: normalizeAvailability,
    WEEKDAY_ORDER: WEEKDAY_ORDER,
    WEEKDAY_SHORT: WEEKDAY_SHORT
  };
})(typeof window !== 'undefined' ? window : globalThis);
