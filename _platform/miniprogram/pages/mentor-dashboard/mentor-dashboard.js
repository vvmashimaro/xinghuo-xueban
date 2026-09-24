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
    bannerText: '',
    bannerClass: 'banner-warn',
    realName: '',
    phone: '',
    idCardMasked: '',
    bankMasked: '',
    spaces: Storage.SPACE_OPTIONS || ['青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'],
    spaceIndex: 0,
    edit: { hourlyRate: '', scoreHighlight: '', lectureUrl: '', slotsText: '' },
    inbox: [],
    pendingInbox: 0,
    sensitiveShow: false,
    sens: { phone: '', bankCardNumber: '', note: '' },
    declineShow: false,
    declineReason: '',
    declineId: ''
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
      bannerText = '您已入库，可接收家长约课并维护非敏感画像。';
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

    const spaces = this.data.spaces;
    let spaceIndex = spaces.indexOf(mentor.spacePreference || (mentor.preferredSpaces && mentor.preferredSpaces[0]));
    if (spaceIndex < 0) spaceIndex = 0;

    const idCard = String(mentor.idCard || '');
    const bank = String(mentor.bankCardNumber || '');
    const slots = mentor.availableSlots || Storage.DEFAULT_SLOTS || [];

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
      bannerText,
      bannerClass,
      realName: mentor.realName,
      phone: mentor.phone,
      idCardMasked: idCard ? idCard.slice(0, 6) + '********' + idCard.slice(-4) : '—',
      bankMasked: bank ? bank.slice(0, 4) + ' **** **** ' + bank.slice(-4) : '—',
      spaceIndex,
      edit: {
        hourlyRate: String(mentor.hourlyRate || ''),
        scoreHighlight: mentor.scoreHighlight || '',
        lectureUrl: mentor.lectureUrl || '',
        slotsText: slots.join('，')
      },
      inbox,
      pendingInbox
    });
  },

  onEdit(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['edit.' + k]: e.detail.value });
  },
  onSpace(e) {
    this.setData({ spaceIndex: Number(e.detail.value) });
  },

  saveProfile() {
    const m = this._mentor;
    if (!m) return;
    const slotsText = this.data.edit.slotsText || '';
    const availableSlots = slotsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const space = this.data.spaces[this.data.spaceIndex];
    Storage.updateMentorProfile(
      m.id,
      {
        hourlyRate: parseInt(this.data.edit.hourlyRate, 10) || m.hourlyRate,
        scoreHighlight: this.data.edit.scoreHighlight,
        lectureUrl: this.data.edit.lectureUrl,
        availableSlots,
        preferredSpaces: [space],
        spacePreference: space
      },
      { sensitiveChange: false }
    );
    showToast('画像已更新');
    this.reload();
  },

  openSensitive() {
    this.setData({
      sensitiveShow: true,
      sens: { phone: this._mentor.phone || '', bankCardNumber: this._mentor.bankCardNumber || '', note: '' }
    });
  },
  closeSensitive() { this.setData({ sensitiveShow: false }); },
  onSens(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['sens.' + k]: e.detail.value });
  },
  submitSensitive() {
    const m = this._mentor;
    const patch = {
      phone: (this.data.sens.phone || '').trim(),
      bankCardNumber: (this.data.sens.bankCardNumber || '').trim()
    };
    if (this.data.sens.note) {
      patch.reviewComment = '【敏感信息变更待复审】' + this.data.sens.note;
    }
    Storage.updateMentorProfile(m.id, patch, { sensitiveChange: true });
    // sync session phone
    const session = Storage.getSession() || {};
    session.phone = patch.phone || session.phone;
    session.mentorId = m.id;
    Storage.setSession(session);
    this.setData({ sensitiveShow: false });
    showToast('已提交敏感变更，进入复审', 'warning');
    this.reload();
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
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
