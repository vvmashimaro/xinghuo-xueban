'use strict';

const BOOKING_CREATE_ALLOW = new Set([
  'mentorId',
  'tutorId',
  'tutorName',
  'subject',
  'space',
  'schedule',
  'timeSlot',
  'hours',
  'type',
  'weekday',
  'time',
  'sessionCount',
  'sessions',
  'parentId',
  'parentName',
  'parentPhone',
  'studentNickname',
  'studentGrade',
  'studentName',
  'grade',
  'paymentMethod',
  'note',
  'remark',
  'sourceBookingId',
  'trialLabel',
  'boothId',
  'boothLabel',
  'teachingPointId',
  'sessionDate',
  'timeConflictForced',
  'hasTimeConflict',
  'timeConflictNote'
]);

const BOOKING_PROTECTED = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'status',
  'declineReason',
  'respondedAt',
  'paymentStatus',
  'amount',
  'total',
  'price',
  'hourlyRate',
  'perSessionAmount',
  'paidAt',
  'transactionId',
  'escrowStatus',
  'summary',
  'completedAt'
]);

const PARENT_PATCH_ALLOW = new Set([
  'schedule',
  'timeSlot',
  'space',
  'subject',
  'studentNickname',
  'studentGrade',
  'studentName',
  'grade',
  'note',
  'remark',
  'sessions',
  'paymentMethod'
]);

const MENTOR_PATCH_ALLOW = new Set([
  'sessions'
]);

const PAYMENT_PATCH_ALLOW = new Set([
  'paymentStatus',
  'paymentMethod',
  'paidAt',
  'transactionId',
  'escrowStatus',
  'amount'
]);

const PARENT_SESSION_PATCH_KEYS = new Set(['parentMessage']);
const MENTOR_SESSION_PATCH_KEYS = new Set(['classSummary']);

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const PARENT_MESSAGE_MAX_LEN = 500;

function _sessionUid(index, dateStr) {
  const d = (dateStr || 'X').replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SES-${d}-${index}-${rand}`;
}

function computeLeaveDeadline(dateStr) {
  if (!dateStr) return '';
  const cursor = new Date(dateStr + 'T00:00:00');
  if (isNaN(cursor.getTime())) return '';
  const leaveDeadlineDate = new Date(cursor);
  leaveDeadlineDate.setDate(leaveDeadlineDate.getDate() - 1);
  leaveDeadlineDate.setHours(23, 59, 59, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    leaveDeadlineDate.getFullYear() +
    '-' +
    pad(leaveDeadlineDate.getMonth() + 1) +
    '-' +
    pad(leaveDeadlineDate.getDate()) +
    ' 23:59'
  );
}

/**
 * Rebuild session list on booking create from schedule fields only.
 */
function rebuildSessionsFromClientInput(rawSessions) {
  if (!Array.isArray(rawSessions)) return [];
  return rawSessions.map((raw, index) => {
    const input = raw && typeof raw === 'object' ? raw : {};
    const date = input.date ? String(input.date).slice(0, 10) : '';
    let weekday = input.weekday != null ? parseInt(input.weekday, 10) : NaN;
    if (isNaN(weekday) && date) {
      weekday = new Date(date + 'T12:00:00').getDay();
    }
    const weekdayLabel =
      input.weekdayLabel ||
      (!isNaN(weekday) && WEEKDAY_LABELS[weekday] ? WEEKDAY_LABELS[weekday] : '');
    const timeStart = input.timeStart ? String(input.timeStart).slice(0, 5) : '';
    const timeEnd = input.timeEnd ? String(input.timeEnd).slice(0, 5) : '';
    const timeLabel =
      input.timeLabel ||
      (timeStart && timeEnd ? `${timeStart}-${timeEnd}` : timeStart || timeEnd || '');
    return {
      id: _sessionUid(index, date),
      date,
      weekday: isNaN(weekday) ? '' : weekday,
      weekdayLabel,
      timeStart,
      timeEnd,
      timeLabel,
      status: 'scheduled',
      escrowStatus: 'frozen',
      leaveRequestedAt: '',
      leaveConfirmedAt: '',
      leaveRequestedBy: '',
      leaveDeadline: computeLeaveDeadline(date),
      completedAt: '',
      releaseAt: ''
    };
  });
}

function assertBookingReadyForComplete(booking) {
  if (!booking) return { ok: false, error: '约课不存在' };
  const status = String(booking.status || '');
  if (status !== 'accepted') {
    return { ok: false, error: '预约尚未被导师接受' };
  }
  const ps = booking.paymentStatus;
  if (ps === 'paid') {
    return { ok: true };
  }
  if (ps === 'waived') {
    return { ok: true };
  }
  return { ok: false, error: '须完成支付后方可结课' };
}

function assertSessionReadyForComplete(session) {
  if (!session) return { ok: false, error: '课次不存在' };
  if (session.status === 'completed') {
    return { ok: true, already: true };
  }
  if (session.status === 'leave_approved' || session.status === 'cancelled') {
    return { ok: false, error: '已请假/取消的课次不可结课' };
  }
  if (session.status === 'leave_pending') {
    return { ok: false, error: '请假待确认课次不可结课' };
  }
  return { ok: true };
}

function bookingEscrowReleaseAllowed(booking) {
  return !!(booking && booking.paymentStatus === 'paid');
}

function pickAllowed(obj, allowedSet) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const key of allowedSet) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      out[key] = obj[key];
    }
  }
  return out;
}

function stripProtectedFields(obj) {
  const out = Object.assign({}, obj || {});
  for (const key of BOOKING_PROTECTED) {
    delete out[key];
  }
  return out;
}

function bookingIsPaid(booking) {
  return !!(booking && booking.paymentStatus === 'paid');
}

/**
 * Merge client session patches into existing sessions by id.
 * Only parentMessage (parent) or classSummary (mentor). No add/remove, no lifecycle fields.
 */
function mergeClientSessionPatch(existingSessions, patchSessions, role) {
  if (!Array.isArray(patchSessions)) return undefined;
  const existing = Array.isArray(existingSessions) ? existingSessions : [];
  const allowedKeys =
    role === 'mentor' ? MENTOR_SESSION_PATCH_KEYS : PARENT_SESSION_PATCH_KEYS;
  if (role !== 'mentor' && role !== 'parent') {
    return existing.slice();
  }

  const patchById = new Map();
  for (const s of patchSessions) {
    if (s && s.id) patchById.set(String(s.id), s);
  }

  return existing.map((sess) => {
    const patch = patchById.get(String(sess.id));
    if (!patch) return sess;
    const next = Object.assign({}, sess);
    for (const key of allowedKeys) {
      if (patch[key] !== undefined) {
        next[key] = patch[key];
      }
    }
    return next;
  });
}

function pickBookingCreateFields(raw) {
  return pickAllowed(raw || {}, BOOKING_CREATE_ALLOW);
}

function filterClientBookingPatch(patch, role, existingBooking) {
  const allowed =
    role === 'mentor' ? MENTOR_PATCH_ALLOW : role === 'parent' ? PARENT_PATCH_ALLOW : new Set();
  let next = pickAllowed(patch || {}, allowed);
  next = stripProtectedFields(next);

  if (bookingIsPaid(existingBooking)) {
    delete next.schedule;
    delete next.timeSlot;
  }

  if (next.sessions !== undefined) {
    next.sessions = mergeClientSessionPatch(
      existingBooking && existingBooking.sessions,
      next.sessions,
      role
    );
  }

  return next;
}

function filterPaymentBookingPatch(patch) {
  return pickAllowed(patch || {}, PAYMENT_PATCH_ALLOW);
}

function filterAdminBookingPatch(patch) {
  const next = Object.assign({}, patch || {});
  delete next.id;
  delete next.createdAt;
  return next;
}

module.exports = {
  pickBookingCreateFields,
  filterClientBookingPatch,
  filterPaymentBookingPatch,
  filterAdminBookingPatch,
  mergeClientSessionPatch,
  rebuildSessionsFromClientInput,
  assertBookingReadyForComplete,
  assertSessionReadyForComplete,
  bookingEscrowReleaseAllowed,
  bookingIsPaid,
  PARENT_MESSAGE_MAX_LEN,
  BOOKING_CREATE_ALLOW,
  BOOKING_PROTECTED
};
