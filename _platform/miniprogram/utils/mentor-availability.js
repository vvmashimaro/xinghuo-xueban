const WEEKDAY_RANGE = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
];

function buildTimeSlots() {
  const slots = [];
  for (let h = 8; h < 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

function timeToMinutes(timeStr) {
  const parts = (timeStr || '00:00').split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function mergeSlots(slots) {
  if (!slots || slots.length === 0) return [];
  const ranges = [];
  let start = slots[0];
  let prev = slots[0];
  for (let i = 1; i < slots.length; i++) {
    const curr = slots[i];
    const prevMins = timeToMinutes(prev);
    const currMins = timeToMinutes(curr);
    if (currMins - prevMins === 30) {
      prev = curr;
    } else {
      ranges.push({ start, end: minutesToTime(timeToMinutes(prev) + 30) });
      start = curr;
      prev = curr;
    }
  }
  ranges.push({ start, end: minutesToTime(timeToMinutes(prev) + 30) });
  return ranges;
}

function loadAvailabilityFromStorage(availabilityArray) {
  const availability = {};
  (availabilityArray || []).forEach((item) => {
    const wd = item.weekday;
    if (!availability[wd]) availability[wd] = {};
    (item.ranges || []).forEach((range) => {
      const startMins = timeToMinutes(range.start);
      const endMins = timeToMinutes(range.end);
      for (let m = startMins; m < endMins; m += 30) {
        availability[wd][minutesToTime(m)] = true;
      }
    });
  });
  let firstSelected = null;
  let firstLabel = '周一';
  WEEKDAY_RANGE.forEach((wd) => {
    if (availability[wd.value] && Object.keys(availability[wd.value]).length > 0 && firstSelected == null) {
      firstSelected = wd.value;
      firstLabel = wd.label;
    }
  });
  const selectedWeekday = firstSelected != null ? firstSelected : 1;
  const activeSlotOn = availability[selectedWeekday] || {};
  return {
    availability,
    selectedWeekday,
    selectedWeekdayLabel: firstLabel,
    activeSlotOn
  };
}

function summarizeAvailability(availability) {
  const summary = [];
  WEEKDAY_RANGE.forEach((wd) => {
    const slots = availability[wd.value] || {};
    const selected = Object.keys(slots).filter((s) => slots[s]).sort();
    if (selected.length > 0) {
      mergeSlots(selected).forEach((r) => {
        summary.push(`${wd.label} ${r.start}-${r.end}`);
      });
    }
  });
  return summary.join(' · ') || '未设置可约时段';
}

function availabilityToArray(availability) {
  const result = [];
  WEEKDAY_RANGE.forEach((wd) => {
    const slots = availability[wd.value] || {};
    const selected = Object.keys(slots).filter((s) => slots[s]).sort();
    if (selected.length > 0) {
      const ranges = mergeSlots(selected);
      if (ranges.length > 0) {
        result.push({ weekday: wd.value, ranges });
      }
    }
  });
  return result;
}

const WD_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 从导师 availability 生成可落入窗口的约课时段（开始+时长须完全落在某一 range 内）。
 * 与服务端 assertMentorAvailability 判定一致。
 */
function bookableWindowsFromAvailability(availability, hours) {
  const duration = Math.max(1, Number(hours) || 2) * 60;
  const out = [];
  const seen = {};
  (availability || []).forEach((item) => {
    const wd = parseInt(item.weekday, 10);
    if (isNaN(wd)) return;
    (item.ranges || []).forEach((range) => {
      const rs = timeToMinutes(range.start);
      const re = timeToMinutes(range.end);
      if (re - rs < duration) return;
      for (let start = rs; start + duration <= re; start += 30) {
        const timeStart = minutesToTime(start);
        const timeEnd = minutesToTime(start + duration);
        const label = (WD_NAMES[wd] || '') + ' ' + timeStart + '-' + timeEnd;
        if (seen[label]) continue;
        seen[label] = true;
        out.push({
          weekday: wd,
          weekdayLabel: WD_NAMES[wd] || '',
          timeStart,
          timeEnd,
          label
        });
      }
    });
  });
  return out;
}

function upcomingDateSlotsFromAvailability(availability, hours, options) {
  const opts = options || {};
  const days = opts.days || 62;
  const limit = opts.limit != null ? opts.limit : 10000;
  const windows = bookableWindowsFromAvailability(availability, hours);
  const byWd = {};
  windows.forEach((w) => {
    if (!byWd[w.weekday]) byWd[w.weekday] = [];
    byWd[w.weekday].push(w);
  });
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const wd = d.getDay();
    (byWd[wd] || []).forEach((w) => {
      if (out.length >= limit) return;
      const end = new Date(d);
      const eh = parseInt(String(w.timeEnd).split(':')[0], 10) || 0;
      const em = parseInt(String(w.timeEnd).split(':')[1], 10) || 0;
      end.setHours(eh, em, 0, 0);
      if (end.getTime() <= now.getTime()) return;
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      out.push(Object.assign({}, w, {
        date: d,
        isoDate: y + '-' + mo + '-' + da
      }));
    });
  }
  return out;
}

function bookableCalendarFromAvailability(availability, hours, options) {
  const slots = upcomingDateSlotsFromAvailability(availability, hours, options || { days: 62 });
  const byDate = {};
  const order = [];
  slots.forEach((s) => {
    const iso = s.isoDate;
    if (!byDate[iso]) {
      byDate[iso] = {
        isoDate: iso,
        weekday: s.weekday,
        weekdayLabel: s.weekdayLabel,
        date: s.date,
        times: []
      };
      order.push(iso);
    }
    byDate[iso].times.push({
      timeStart: s.timeStart,
      timeEnd: s.timeEnd,
      label: s.timeStart + ' – ' + s.timeEnd
    });
  });
  return order.map((iso) => byDate[iso]);
}

function windowCoversSession(availability, session) {
  const windows = bookableWindowsFromAvailability(
    availability,
    session && session.hours != null
      ? session.hours
      : Math.max(
        1,
        Math.round(
          (timeToMinutes((session && session.timeEnd) || '') -
            timeToMinutes((session && session.timeStart) || '')) / 60
        ) || 2
      )
  );
  const wd = parseInt(session && session.weekday, 10);
  const start = String((session && session.timeStart) || '');
  const end = String((session && session.timeEnd) || '');
  return windows.some((w) => w.weekday === wd && w.timeStart === start && w.timeEnd === end);
}

module.exports = {
  WEEKDAY_RANGE,
  TIME_SLOTS,
  WD_NAMES,
  timeToMinutes,
  minutesToTime,
  mergeSlots,
  loadAvailabilityFromStorage,
  summarizeAvailability,
  availabilityToArray,
  bookableWindowsFromAvailability,
  upcomingDateSlotsFromAvailability,
  bookableCalendarFromAvailability,
  windowCoversSession
};
