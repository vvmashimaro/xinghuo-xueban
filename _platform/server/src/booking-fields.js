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
  'trialLabel'
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
  bookingIsPaid,
  BOOKING_CREATE_ALLOW,
  BOOKING_PROTECTED
};
