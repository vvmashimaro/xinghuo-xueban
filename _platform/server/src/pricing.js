'use strict';

/**
 * Booking amount in yuan (CNY). WeChat prepay uses fen (yuan * 100).
 */

function resolveHourlyRate(mentor) {
  if (!mentor) return null;
  const rate = Number(mentor.hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

function roundYuan(value) {
  return Math.round(Number(value) * 100) / 100;
}

function yuanToFen(yuan) {
  return Math.round(roundYuan(yuan) * 100);
}

function fenToYuan(fen) {
  return roundYuan(Number(fen) / 100);
}

/**
 * Compute authoritative booking price from mentor rate + duration metadata.
 * Ignores any client-supplied amount fields.
 */
function computeBookingPricing(mentor, bookingInput) {
  const booking = bookingInput || {};
  const type = booking.type || 'one_off';

  if (type === 'trial') {
    return {
      amount: 0,
      hours: 1,
      sessionCount: 1,
      perSessionAmount: 0,
      escrowStatus: 'waived',
      trialLabel: booking.trialLabel || '首次试课 · 1小时免费'
    };
  }

  const rate = resolveHourlyRate(mentor);
  if (rate == null) {
    return { error: '导师未设置有效课时费，无法预约' };
  }

  const hours = Math.max(1, Number(booking.hours) || 2);

  if (type === 'weekly') {
    const fromSessions = Array.isArray(booking.sessions) ? booking.sessions.length : 0;
    const sessionCount = Math.max(
      1,
      parseInt(booking.sessionCount, 10) || fromSessions || 4
    );
    const perSessionAmount = roundYuan(rate * hours);
    const amount = roundYuan(perSessionAmount * sessionCount);
    return {
      amount,
      hours,
      sessionCount,
      perSessionAmount,
      escrowStatus: amount > 0 ? 'pending_payment' : 'waived'
    };
  }

  const amount = roundYuan(rate * hours);
  return {
    amount,
    hours,
    sessionCount: 1,
    perSessionAmount: amount,
    escrowStatus: amount > 0 ? 'pending_payment' : 'waived'
  };
}

function bookingAmountYuan(booking) {
  if (!booking) return 0;
  if (booking.type === 'trial') return 0;
  return roundYuan(booking.amount);
}

function bookingAmountFen(booking) {
  const yuan = bookingAmountYuan(booking);
  if (yuan <= 0) return 0;
  return yuanToFen(yuan);
}

function isBookingPayable(booking) {
  if (!booking) return { ok: false, error: '预约不存在' };
  if (booking.paymentStatus === 'paid') {
    return { ok: false, error: '预约已支付' };
  }
  const status = String(booking.status || '').toLowerCase();
  if (status === 'cancelled' || status === 'declined') {
    return { ok: false, error: '预约状态不可支付' };
  }
  const fen = bookingAmountFen(booking);
  if (fen <= 0) {
    return { ok: false, error: '该预约无需支付' };
  }
  return { ok: true, amountFen: fen, amountYuan: bookingAmountYuan(booking) };
}

module.exports = {
  computeBookingPricing,
  bookingAmountFen,
  bookingAmountYuan,
  yuanToFen,
  fenToYuan,
  isBookingPayable,
  resolveHourlyRate
};
