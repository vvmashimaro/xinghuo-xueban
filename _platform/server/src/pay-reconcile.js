'use strict';

const pricing = require('./pricing');

function amountsMatchFen(expected, actual) {
  if (expected == null || actual == null) return true;
  return Number(expected) === Number(actual);
}

function isTerminalRefundStatus(status) {
  const st = String(status || '').toUpperCase();
  return st === 'REFUND' || st === 'REFUNDED';
}

function bookingNeedsPaySync(booking) {
  if (!booking) return false;
  const ps = String(booking.paymentStatus || '').toLowerCase();
  return ps !== 'paid' && ps !== 'waived' && ps !== 'refunded';
}

function applyPaySuccessLocal(db, payOrder, remote, options) {
  const notify = options && options.notify === true;
  if (!payOrder) {
    return { ok: false, error: '订单不存在' };
  }
  if (payOrder.status === 'SUCCESS') {
    return { ok: true, synced: false, idempotent: true };
  }
  if (!amountsMatchFen(payOrder.amount, remote.amount)) {
    return {
      ok: false,
      error: `金额不匹配 local=${payOrder.amount} remote=${remote.amount}`,
      code: 'AMOUNT_MISMATCH'
    };
  }
  db.savePayOrder({
    outTradeNo: payOrder.outTradeNo,
    status: 'SUCCESS',
    transactionId: remote.transactionId,
    successTime: remote.successTime || new Date().toISOString()
  });
  let booking = payOrder.bookingId
    ? db.getBookings().find((b) => b.id === payOrder.bookingId)
    : null;
  if (booking && booking.paymentStatus !== 'paid') {
    const payable = pricing.isBookingPayable(booking);
    const patch = {
      paymentStatus: 'paid',
      paymentMethod: 'wechat',
      paidAt: remote.successTime || new Date().toISOString(),
      transactionId: remote.transactionId,
      escrowStatus: 'frozen'
    };
    if (payable.ok && payable.amountYuan != null) {
      patch.amount = payable.amountYuan;
    }
    booking = db.updateBooking(booking.id, patch, { trust: 'payment' });
    if (notify && options.onPaid) {
      options.onPaid(booking);
    }
  }
  return { ok: true, synced: true, booking };
}

async function resolveWechatRefundStatus(wechatPay, payOrder) {
  if (payOrder.outRefundNo) {
    const one = await wechatPay.queryRefundByOutRefundNo(payOrder.outRefundNo);
    return one;
  }
  const bundle = await wechatPay.queryRefundsByOutTradeNo(payOrder.outTradeNo);
  const latest = wechatPay.pickLatestRefund(bundle.refunds || []);
  if (!latest) {
    return { outTradeNo: payOrder.outTradeNo, status: '', mock: bundle.mock };
  }
  return latest;
}

/**
 * Compare WeChat pay/refund state with local payOrders (+ booking escrow when applicable).
 * @param {{ db, wechatPay }} deps
 * @param {{ apply?: boolean, outTradeNo?: string, limit?: number, onPaid?: Function }} options
 */
async function reconcileWechatPay(deps, options) {
  const db = deps.db;
  const wechatPay = deps.wechatPay;
  const apply = !!(options && options.apply);
  const limit = Math.min(200, Math.max(1, (options && options.limit) || 50));
  const filterNo = options && options.outTradeNo ? String(options.outTradeNo).trim() : '';

  let orders = db.getPayOrders();
  if (filterNo) {
    orders = orders.filter((o) => String(o.outTradeNo || '') === filterNo);
  }

  const mismatches = [];
  const applied = [];
  const skipped = [];
  let examined = 0;

  for (const order of orders) {
    if (examined >= limit) break;
    const outTradeNo = order.outTradeNo;
    if (!outTradeNo) continue;

    const booking = order.bookingId
      ? db.getBookings().find((b) => b.id === order.bookingId)
      : null;

    // —— Refund: local refund_pending but WeChat already SUCCESS ——
    if (order.status === 'refund_pending') {
      examined += 1;
      let remoteRefund;
      try {
        remoteRefund = await resolveWechatRefundStatus(wechatPay, order);
      } catch (err) {
        mismatches.push({
          kind: 'refund_query_error',
          outTradeNo,
          bookingId: order.bookingId,
          localStatus: order.status,
          error: err && err.message
        });
        continue;
      }
      const wxStatus = String((remoteRefund && remoteRefund.status) || '').toUpperCase();
      if (wxStatus === 'SUCCESS') {
        const entry = {
          kind: 'refund_pending_vs_wx_success',
          outTradeNo,
          bookingId: order.bookingId,
          localStatus: order.status,
          remoteStatus: wxStatus,
          refundId: remoteRefund.refundId,
          outRefundNo: remoteRefund.outRefundNo
        };
        mismatches.push(entry);
        if (apply) {
          const result = db.refundPayOrder(outTradeNo, {
            wxStatus: 'SUCCESS',
            refundId: remoteRefund.refundId,
            outRefundNo: remoteRefund.outRefundNo,
            refundedBy: 'reconcile',
            reason: order.refundReason || '微信退款对账同步'
          });
          if (result.ok) {
            applied.push(Object.assign({}, entry, { action: 'complete_refund' }));
          } else {
            skipped.push(Object.assign({}, entry, { action: 'complete_refund', error: result.error }));
          }
        }
      } else if (wxStatus === 'PROCESSING') {
        mismatches.push({
          kind: 'refund_still_processing',
          outTradeNo,
          bookingId: order.bookingId,
          localStatus: order.status,
          remoteStatus: wxStatus
        });
      } else if (wxStatus) {
        mismatches.push({
          kind: 'refund_status_drift',
          outTradeNo,
          bookingId: order.bookingId,
          localStatus: order.status,
          remoteStatus: wxStatus
        });
      }
      continue;
    }

    // —— Pay: WeChat SUCCESS but local not marked paid ——
    const needsPayCheck =
      !isTerminalRefundStatus(order.status) &&
      order.status !== 'refund_pending' &&
      order.status !== 'refund_failed' &&
      (order.status !== 'SUCCESS' || bookingNeedsPaySync(booking));

    if (!needsPayCheck) continue;
    examined += 1;

    let remotePay;
    try {
      remotePay = await wechatPay.queryTransactionByOutTradeNo(outTradeNo);
    } catch (err) {
      mismatches.push({
        kind: 'pay_query_error',
        outTradeNo,
        bookingId: order.bookingId,
        localStatus: order.status,
        error: err && err.message
      });
      continue;
    }
    const tradeState = String((remotePay && remotePay.tradeState) || '').toUpperCase();
    if (tradeState !== 'SUCCESS') continue;

    const entry = {
      kind: order.status === 'SUCCESS' ? 'booking_unpaid_vs_wx_success' : 'pay_local_unpaid_vs_wx_success',
      outTradeNo,
      bookingId: order.bookingId,
      localStatus: order.status,
      remoteStatus: tradeState,
      bookingPaymentStatus: booking && booking.paymentStatus
    };
    mismatches.push(entry);
    if (apply) {
      const result = applyPaySuccessLocal(db, order, remotePay, {
        notify: !!(options && options.onPaid),
        onPaid: options && options.onPaid
      });
      if (result.ok && result.synced) {
        applied.push(Object.assign({}, entry, { action: 'mark_paid' }));
      } else if (result.ok && result.idempotent) {
        skipped.push(Object.assign({}, entry, { action: 'mark_paid', note: 'already_success' }));
      } else {
        skipped.push(Object.assign({}, entry, { action: 'mark_paid', error: result.error }));
      }
    }
  }

  return {
    dryRun: !apply,
    examined,
    mismatchCount: mismatches.length,
    mismatches,
    applied,
    skipped
  };
}

module.exports = {
  reconcileWechatPay,
  applyPaySuccessLocal,
  amountsMatchFen
};
