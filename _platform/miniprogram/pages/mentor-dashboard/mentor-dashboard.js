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
    pendingInbox: 0,
    declineShow: false,
    declineReason: '',
    declineId: '',
    settingsDrawerShow: false,
    consoleSection: 'courses',
    consoleFabShow: false
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
    const pendingInbox = inboxRaw.filter(
      (b) => b.status === 'pending_accept' || b.status === 'escrow_locked'
    ).length;
    const inbox = inboxRaw.map((b) => {
      const meta = BOOKING_STATUS[b.status] || { text: b.status, badge: 'badge-teal' };
      return Object.assign({}, b, {
        statusText: meta.text,
        statusBadge: meta.badge,
        canAct: b.status === 'pending_accept' || b.status === 'escrow_locked'
      });
    });

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
      pendingInbox
    });
  },

  onConsoleTab(e) {
    const id = e.currentTarget.dataset.id;
    if (id) this.setData({ consoleSection: id });
  },
  toggleConsoleFab() {
    this.setData({ consoleFabShow: !this.data.consoleFabShow });
  },
  closeConsoleFab() {
    this.setData({ consoleFabShow: false });
  },
  pickConsoleSection(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ consoleSection: id || 'courses', consoleFabShow: false });
  },
  openSettingsDrawerFromFab() {
    this.setData({ consoleFabShow: false });
    this.openSettingsDrawer();
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

  goLogin() {
    this.closeSettingsDrawer();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
