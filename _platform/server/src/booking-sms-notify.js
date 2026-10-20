'use strict';

/**
 * 约课接单/退单短信通知（失败仅打日志，不抛错）
 */
const sms = require('./sms');

function bookingInfoFromRecord(booking, overrides = {}) {
  return {
    tutorName: booking.tutorName || '导师',
    studentName: booking.studentNickname || booking.studentName || '学员',
    subject: booking.subject || '课程',
    schedule: booking.schedule || booking.timeSlot || '',
    space: booking.space || '',
    reason: overrides.reason || booking.declineReason || ''
  };
}

function mentorPhoneForBooking(db, booking) {
  const mentorId = booking.mentorId || booking.tutorId;
  if (!mentorId || !db || typeof db.getMentorById !== 'function') return null;
  const mentor = db.getMentorById(mentorId);
  if (!mentor || !mentor.phone) return null;
  const phone = String(mentor.phone).trim();
  return /^1[3-9]\d{9}$/.test(phone) ? phone : null;
}

function isAcceptDecision(body) {
  const d = body || {};
  return d.accept === true || d.action === 'accept';
}

function isDeclineDecision(body) {
  const d = body || {};
  return d.accept === false || d.decline === true || d.action === 'decline';
}

async function safeSend(fn) {
  try {
    await fn();
  } catch (err) {
    console.error('[Booking SMS Notify]', err);
  }
}

/** 新约课创建：通知导师接单 */
async function notifyBookingCreated(booking, db) {
  if (!booking) return;
  const mentorPhone = mentorPhoneForBooking(db, booking);
  if (!mentorPhone) return;
  const info = bookingInfoFromRecord(booking);
  await safeSend(() => sms.sendBookingNotification(mentorPhone, info));
}

/** 导师响应预约（接单 / 拒单） */
async function notifyBookingRespond(booking, decisionBody, db) {
  if (!booking) return;

  if (isAcceptDecision(decisionBody)) {
    const info = bookingInfoFromRecord(booking);
    if (booking.parentPhone) {
      await safeSend(() => sms.sendBookingAcceptNotification(booking.parentPhone, info));
    }
    if (process.env.SMS_NOTIFY_MENTOR_ON_ACCEPT === 'true') {
      const mentorPhone = mentorPhoneForBooking(db, booking);
      if (mentorPhone) {
        await safeSend(() => sms.sendBookingMentorAcceptNotification(mentorPhone, info));
      }
    }
    return;
  }

  if (isDeclineDecision(decisionBody)) {
    const info = bookingInfoFromRecord(booking, {
      reason: (decisionBody && (decisionBody.reason || decisionBody.declineReason)) ||
        booking.declineReason ||
        '导师暂时无法承接此时段'
    });
    if (booking.parentPhone) {
      await safeSend(() =>
        sms.sendBookingCancelNotification(booking.parentPhone, info, { cancelledBy: 'mentor' })
      );
    }
  }
}

/** 家长撤销约课：通知导师（退款短信由 cancel 路由单独发送家长） */
async function notifyParentCancel(booking, db) {
  if (!booking) return;
  const mentorPhone = mentorPhoneForBooking(db, booking);
  if (!mentorPhone) return;

  const info = bookingInfoFromRecord(booking, { reason: '家长已撤销约课' });
  await safeSend(() => sms.sendBookingCancelMentorNotification(mentorPhone, info));
}

module.exports = {
  notifyBookingCreated,
  notifyBookingRespond,
  notifyParentCancel,
  bookingInfoFromRecord,
  mentorPhoneForBooking
};
