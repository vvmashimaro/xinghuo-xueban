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
  'sessions',
  'completedAt'
]);

const PAYMENT_PATCH_ALLOW = new Set([
  'paymentStatus',
  'paymentMethod',
  'paidAt',
  'transactionId',
  'escrowStatus',
  'amount'
]);

const SESSION_CLIENT_ALLOW = new Set([
  'id',
  'date',
  'weekday',
  'weekdayLabel',
  'timeStart',
  'timeEnd',
  'timeLabel',
  'status',
  'leaveRequestedAt',
  'leaveConfirmedAt',
  'leaveRequestedBy',
  'leaveDeadline',
  'completedAt',
  'releaseAt',
  'completedBy',
  'classSummary',
  'parentMessage'
]);

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

function sanitizeClientSessions(sessions) {
  if (!Array.isArray(sessions)) return sessions;
  return sessions.map((sess) => {
    if (!sess || typeof sess !== 'object') return sess;
    const picked = pickAllowed(sess, SESSION_CLIENT_ALLOW);
    delete picked.escrowStatus;
    delete picked.amount;
    return picked;
  });
}

function pickBookingCreateFields(raw) {
  return pickAllowed(raw || {}, BOOKING_CREATE_ALLOW);
}

function filterClientBookingPatch(patch, role) {
  const allowed =
    role === 'mentor' ? MENTOR_PATCH_ALLOW : role === 'parent' ? PARENT_PATCH_ALLOW : new Set();
  let next = pickAllowed(patch || {}, allowed);
  next = stripProtectedFields(next);
  if (next.sessions !== undefined) {
    next.sessions = sanitizeClientSessions(next.sessions);
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
  BOOKING_CREATE_ALLOW,
  BOOKING_PROTECTED
};
