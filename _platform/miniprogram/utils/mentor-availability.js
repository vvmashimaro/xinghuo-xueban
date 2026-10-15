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

module.exports = {
  WEEKDAY_RANGE,
  TIME_SLOTS,
  timeToMinutes,
  minutesToTime,
  mergeSlots,
  loadAvailabilityFromStorage,
  summarizeAvailability,
  availabilityToArray
};
