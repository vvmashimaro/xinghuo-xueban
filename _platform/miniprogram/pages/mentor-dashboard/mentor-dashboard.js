const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

const STATUS_LABEL = {
  pending: '待初审',
  approved: '已入库',
  rejected: '已否决',
  supplement: '需补件'
};

const BOOKING_STATUS = {
  pending_accept: { text: '待接单', badge: 'badge-pending' },
  escrow_locked: { text: '托管锁定', badge: 'badge-pending' },
  accepted: { text: '已接单', badge: 'badge-approved' },
  declined: { text: '已婉拒', badge: 'badge-rejected' }
};

Page({
  data: {
    mentorName: '',
    university: '',
    code: '',
    status: 'pending',
    statusLabel: '',
    submitTime: '',
    evalGrade: '',
    reviewComment: '',
    chsiStatusShort: '',
    bannerText: '',
    bannerClass: 'banner-warn',
    inbox: [],
    filteredInbox: [],
    inboxFilter: 'all',
    inboxEmptyText: '暂无约课申请。家长预约后将出现在此处。',
    pendingInbox: 0,
    courseBadgeCount: 0,
    declineShow: false,
    declineReason: '',
    declineId: '',
    completeShow: false,
    completeMeta: '',
    completeBid: '',
    completeSid: '',
    summaryTitle: '',
    summaryContent: '',
    settingsDrawerShow: false,
    consoleSection: 'courses'
  },

  async onShow() {
    this.reload();
  },

  async reload() {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    let mentor = Storage.getCurrentMentor();
    if (!mentor) {
      const session = Storage.getSession() || {};
      if (session.phone) mentor = Storage.getMentorByPhone(session.phone);
    }
    if (!mentor) {
      showToast('未找到导师档案，请先完成 L1/L2 建档', 'warning');
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/mentor-onboard/mentor-onboard' });
      }, 500);
      return;
    }
    this._mentor = mentor;
    const st = mentor.status || 'pending';
    let bannerText = '';
    let bannerClass = 'banner-warn';
    if (st === 'approved' && !mentor.sensitiveChangePending) {
      bannerText = '您已入库，可接收家长约课。资料维护请点右侧功能键。';
      bannerClass = 'banner-ok';
    } else if (mentor.sensitiveChangePending || st === 'pending') {
      bannerText = mentor.sensitiveChangePending
        ? '敏感信息变更待复审，期间约课入口可能受限。'
        : '入库申请审核中，请耐心等待教研质审。';
      bannerClass = 'banner-warn';
    } else if (st === 'supplement') {
      bannerText = '需补交材料后复审，请按审核意见完善资料。';
      bannerClass = 'banner-warn';
    } else if (st === 'rejected') {
      bannerText = '申请已被否决，如有疑问请联系平台教研客服。';
      bannerClass = 'banner-bad';
    }

    const inboxRaw = Storage.getBookingsForMentor(mentor.id);
    const isUnpaid = (b) => !!(Storage.bookingIsUnpaid && Storage.bookingIsUnpaid(b));
    const pendingInbox = inboxRaw.filter(
      (b) => !isUnpaid(b) && (b.status === 'pending_accept' || b.status === 'escrow_locked')
    ).length;
    const sessStatusText = {
      scheduled: '已排课',
      completed: '已结课',
      leave_pending: '请假待确认',
      leave_approved: '已批准请假',
      leave_too_late: '请假过晚',
      cancelled: '已取消'
    };
    const inbox = inboxRaw.map((b) => {
      const unpaid = isUnpaid(b);
      const meta = unpaid
        ? { text: '待家长支付', badge: 'badge-teal' }
        : (BOOKING_STATUS[b.status] || { text: b.status, badge: 'badge-teal' });
      const sessionRows = (b.sessions || []).map((s) => {
        const canComplete = !unpaid && b.status === 'accepted' && s.status === 'scheduled';
        const canLeaveAct = !unpaid && s.status === 'leave_pending';
        const canEditSummary = !unpaid && s.status === 'completed' && !s.classSummary;
        return {
          id: s.id,
          label: (s.date || '') + ' ' + (s.timeLabel || s.timeStart || ''),
          statusText: sessStatusText[s.status] || s.status || '',
          canComplete,
          canLeaveAct,
          canEditSummary
        };
      });
      return Object.assign({}, b, {
        statusText: meta.text,
        statusBadge: meta.badge,
        canAct: !unpaid && (b.status === 'pending_accept' || b.status === 'escrow_locked'),
        hasCompleted: (b.sessions || []).some((s) => s.status === 'completed'),
        sessionRows
      });
    });
    const inboxFilter = this.data.inboxFilter || 'all';
    let filteredInbox = inbox.slice();
    if (inboxFilter === 'pending') {
      filteredInbox = inbox.filter((b) => !isUnpaid(b) && (b.status === 'pending_accept' || b.status === 'escrow_locked'));
    } else if (inboxFilter === 'accepted') {
      filteredInbox = inbox.filter((b) => b.status === 'accepted');
    } else if (inboxFilter === 'completed') {
      filteredInbox = inbox.filter((b) => b.hasCompleted);
    }
    const inboxEmptyText = inbox.length === 0
      ? '暂无约课申请。家长预约后将出现在此处。'
      : (filteredInbox.length === 0 ? '该状态下暂无约课' : '');
    const leavePendingCount = inboxRaw.reduce(
      (n, b) => n + ((b.sessions || []).filter((s) => s.status === 'leave_pending').length),
      0
    );

    this.setData({
      mentorName: (mentor.realName || '导').charAt(0) + '老师',
      university: mentor.university || '',
      code: mentor.code || mentor.id,
      status: st,
      statusLabel: STATUS_LABEL[st] || st,
      submitTime: mentor.submitTime || mentor.updatedAt || '—',
      evalGrade: mentor.evalGrade || '待教研评级',
      reviewComment: mentor.reviewComment || '暂无',
      chsiStatusShort: mentor.chsiStatus || '待核验',
      bannerText,
      bannerClass,
      inbox,
      filteredInbox,
      inboxEmptyText,
      pendingInbox,
      courseBadgeCount: pendingInbox + leavePendingCount
    });
  },

  setInboxFilter(e) {
    this.setData({ inboxFilter: e.currentTarget.dataset.v || 'all' }, () => this.reload());
  },

  onConsoleTab(e) {
    const id = e.currentTarget.dataset.id;
    if (id) this.setData({ consoleSection: id });
  },
  openSettingsDrawer() {
    this.setData({ settingsDrawerShow: true });
  },
  closeSettingsDrawer() {
    this.setData({ settingsDrawerShow: false });
  },
  goSettingsPage(e) {
    const url = e.currentTarget.dataset.url;
    this.closeSettingsDrawer();
    if (url) wx.navigateTo({ url });
  },

  acceptBooking(e) {
    const id = e.currentTarget.dataset.id;
    Storage.respondToBooking(id, { accept: true });
    showToast('已接单');
    this.reload();
  },
  openDecline(e) {
    this.setData({
      declineShow: true,
      declineId: e.currentTarget.dataset.id,
      declineReason: ''
    });
  },
  closeDecline() { this.setData({ declineShow: false }); },
  onDeclineReason(e) { this.setData({ declineReason: e.detail.value }); },
  confirmDecline() {
    const reason = (this.data.declineReason || '').trim() || '导师暂时无法承接此时段';
    Storage.respondToBooking(this.data.declineId, { decline: true, reason });
    this.setData({ declineShow: false });
    showToast('已婉拒', 'warning');
    this.reload();
  },

  openComplete(e) {
    const bid = e.currentTarget.dataset.bid;
    const sid = e.currentTarget.dataset.sid;
    const booking = (this.data.inbox || []).find((b) => b.id === bid) || {};
    const sess = (booking.sessionRows || []).find((s) => s.id === sid) || {};
    this.setData({
      completeShow: true,
      completeBid: bid,
      completeSid: sid,
      completeMeta: (booking.studentNickname || '学员') + ' · ' + (booking.subject || '') + ' · ' + (sess.label || ''),
      summaryTitle: '',
      summaryContent: ''
    });
  },
  closeComplete() {
    this.setData({ completeShow: false, completeBid: '', completeSid: '' });
  },
  onSummaryTitle(e) { this.setData({ summaryTitle: e.detail.value }); },
  onSummaryContent(e) { this.setData({ summaryContent: e.detail.value }); },
  async confirmCompleteOnly() {
    await this._completeSession(false);
  },
  async confirmCompleteWithSummary() {
    await this._completeSession(true);
  },
  async _completeSession(withSummary) {
    const bid = this.data.completeBid;
    const sid = this.data.completeSid;
    if (!bid || !sid) return;
    const content = String(this.data.summaryContent || '').trim();
    if (withSummary && !content) {
      showToast('请填写课后小结内容，或选择「仅确认结课」', 'warning');
      return;
    }
    const classSummary = withSummary
      ? {
        title: String(this.data.summaryTitle || '').trim(),
        content,
        tags: []
      }
      : null;
    const res = await Storage.completeSession(bid, sid, {
      completedBy: 'mentor',
      classSummary
    });
    this.closeComplete();
    if (res && res.ok !== false && !res.error) {
      showToast(withSummary ? '已确认结课并保存小结' : '已确认结课 · 进入 48 小时观察期');
    } else {
      showToast((res && (res.error || res.message)) || '结课失败', 'warning');
    }
    this.reload();
  },
  async onLeaveDecide(e) {
    const bid = e.currentTarget.dataset.bid;
    const sid = e.currentTarget.dataset.sid;
    const ok = String(e.currentTarget.dataset.ok) !== '0';
    const res = await Storage.confirmSessionLeave(bid, sid, ok);
    if (res && res.ok !== false && !res.error) {
      showToast(ok ? '已确认请假' : '已驳回请假，课次恢复');
    } else {
      showToast((res && (res.error || res.message)) || '操作失败', 'warning');
    }
    this.reload();
  },

  goLogin() {
    this.closeSettingsDrawer();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
