'use strict';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WD_MAP = { 周日: 0, 周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6 };

function parseTimeToMinutes(t) {
  const m = String(t || '').trim().match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function sessionRangeMinutes(session) {
  const start = parseTimeToMinutes(session.timeStart);
  let end = parseTimeToMinutes(session.timeEnd);
  if (start == null) return null;
  if (end == null || end <= start) {
    end = start + 120;
  }
  return { start, end };
}

function rangesOverlap(a, b) {
  if (!a || !b) return false;
  return a.start < b.end && b.start < a.end;
}

function sameCalendarDay(s1, s2) {
  if (s1.date && s2.date) return s1.date === s2.date;
  if (s1.weekday != null && s2.weekday != null && s1.weekday !== '') {
    return String(s1.weekday) === String(s2.weekday);
  }
  return false;
}

function sessionsTimeOverlap(s1, s2) {
  if (!sameCalendarDay(s1, s2)) return false;
  const r1 = sessionRangeMinutes(s1);
  const r2 = sessionRangeMinutes(s2);
  if (!r1 || !r2) return false;
  return rangesOverlap(r1, r2);
}

function bookingIsActive(b) {
  if (!b) return false;
  const st = String(b.status || '');
  return st !== 'declined' && st !== 'cancelled';
}

function studentKeyFromBooking(b) {
  if (!b) return '';
  const nick = (b.studentNickname || b.studentName || '').trim();
  const parent = (b.parentId || b.parentPhone || '').trim();
  return parent + '::' + nick;
}

function flattenBookingSessions(booking) {
  const out = [];
  const list = Array.isArray(booking.sessions) ? booking.sessions : [];
  list.forEach((s) => {
    if (!s) return;
    out.push({
      bookingId: booking.id,
      subject: booking.subject,
      tutorName: booking.tutorName,
      date: s.date || '',
      weekday: s.weekday,
      timeStart: s.timeStart || '',
      timeEnd: s.timeEnd || '',
      timeLabel: s.timeLabel || ''
    });
  });
  return out;
}

function findStudentTimeConflicts(newSessions, existingBookings, studentKey, excludeBookingId) {
  const conflicts = [];
  const mine = (existingBookings || []).filter((b) => {
    if (!bookingIsActive(b)) return false;
    if (excludeBookingId && b.id === excludeBookingId) return false;
    return studentKeyFromBooking(b) === studentKey;
  });
  const existingSessions = [];
  mine.forEach((b) => existingSessions.push(...flattenBookingSessions(b)));

  (newSessions || []).forEach((ns) => {
    existingSessions.forEach((es) => {
      if (sessionsTimeOverlap(ns, es)) {
        conflicts.push({
          withBookingId: es.bookingId,
          subject: es.subject,
          tutorName: es.tutorName,
          when: (es.date || '') + ' ' + (es.timeLabel || es.timeStart || '')
        });
      }
    });
  });
  return conflicts;
}

function mentorCoversSession(mentor, session) {
  const availability = (mentor && mentor.availability) || [];
  if (!availability.length) return true;
  let wd = session.weekday;
  if ((wd == null || wd === '') && session.date) {
    wd = new Date(session.date + 'T12:00:00').getDay();
  }
  wd = parseInt(wd, 10);
  if (isNaN(wd)) return false;
  const day = availability.find((a) => parseInt(a.weekday, 10) === wd);
  if (!day || !day.ranges || !day.ranges.length) return false;
  const sess = sessionRangeMinutes(session);
  if (!sess) return false;
  return day.ranges.some((r) => {
    const rs = parseTimeToMinutes(r.start);
    const re = parseTimeToMinutes(r.end);
    if (rs == null || re == null) return false;
    return rs <= sess.start && re >= sess.end;
  });
}

function assertMentorAvailability(mentor, sessions) {
  for (const s of sessions || []) {
    if (!mentorCoversSession(mentor, s)) {
      return {
        ok: false,
        error: '所选时段不在导师可约时间内，请调整时间或更换导师',
        code: 'MENTOR_UNAVAILABLE'
      };
    }
  }
  return { ok: true };
}

function findBoothConflicts(bookings, teachingPointId, boothId, newSessions, excludeBookingId) {
  const conflicts = [];
  (bookings || []).forEach((b) => {
    if (!bookingIsActive(b)) return;
    if (excludeBookingId && b.id === excludeBookingId) return;
    if (b.teachingPointId !== teachingPointId || b.boothId !== boothId) return;
    flattenBookingSessions(b).forEach((es) => {
      (newSessions || []).forEach((ns) => {
        if (sessionsTimeOverlap(ns, es)) {
          conflicts.push({
            bookingId: b.id,
            when: (es.date || '') + ' ' + (es.timeLabel || es.timeStart || '')
          });
        }
      });
    });
  });
  return conflicts;
}

function pickAvailableBooth(teachingPoint, sessions, bookings, excludeBookingId) {
  const booths = (teachingPoint && teachingPoint.booths) || [];
  for (const booth of booths) {
    const c = findBoothConflicts(
      bookings,
      teachingPoint.id,
      booth.id,
      sessions,
      excludeBookingId
    );
    if (!c.length) return booth;
  }
  return null;
}

function parseOneOffSessionFromSchedule(booking) {
  const schedule = String((booking && (booking.schedule || booking.timeSlot)) || '').trim();
  if (!schedule) return null;
  const timeMatch = schedule.match(/(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})/);
  const timeStart = timeMatch ? timeMatch[1].padStart(5, '0') : '';
  const timeEnd = timeMatch ? timeMatch[2].padStart(5, '0') : '';
  let weekday = booking.weekday;
  let weekdayLabel = '';
  let date = '';
  if (booking.sessionDate) {
    date = String(booking.sessionDate).slice(0, 10);
    weekday = new Date(date + 'T12:00:00').getDay();
  }
  Object.keys(WD_MAP).forEach((name) => {
    if (schedule.indexOf(name) >= 0) {
      weekday = WD_MAP[name];
      weekdayLabel = name;
    }
  });
  if (weekdayLabel === '' && weekday != null && !isNaN(parseInt(weekday, 10))) {
    weekdayLabel = WEEKDAY_LABELS[parseInt(weekday, 10)] || '';
  }
  const iso = schedule.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) date = iso[1];
  if (!timeStart) return null;
  return {
    date,
    weekday: weekday != null && weekday !== '' ? parseInt(weekday, 10) : '',
    weekdayLabel,
    timeStart,
    timeEnd: timeEnd || timeStart,
    timeLabel: timeStart + '-' + (timeEnd || timeStart)
  };
}

function ensureSessionsForBooking(booking, rebuildFromClient, buildWeeklySessions) {
  let sessions = rebuildFromClient(Array.isArray(booking.sessions) ? booking.sessions : []);
  const type = booking.type || 'one_off';
  if (!sessions.length && type === 'weekly') {
    sessions = buildWeeklySessions(
      booking.weekday,
      booking.time || booking.timeStart,
      booking.hours,
      booking.sessionCount,
      booking.sessionDate
    );
  }
  if (!sessions.length && type !== 'trial') {
    const one = parseOneOffSessionFromSchedule(booking);
    if (one) {
      sessions = [
        Object.assign({}, one, {
          id: 'SES-PARSE-0',
          status: 'scheduled',
          escrowStatus: 'frozen'
        })
      ];
    }
  }
  return sessions;
}

function teachingPointBySpaceName(teachingPoints, spaceName) {
  const name = String(spaceName || '').trim();
  if (!name) return null;
  return (
    (teachingPoints || []).find((tp) => tp.name === name) ||
    (teachingPoints || []).find((tp) => name.indexOf(tp.name) >= 0 || tp.name.indexOf(name) >= 0) ||
    null
  );
}

module.exports = {
  parseTimeToMinutes,
  sessionsTimeOverlap,
  findStudentTimeConflicts,
  assertMentorAvailability,
  findBoothConflicts,
  pickAvailableBooth,
  ensureSessionsForBooking,
  teachingPointBySpaceName,
  studentKeyFromBooking,
  flattenBookingSessions,
  bookingIsActive
};
