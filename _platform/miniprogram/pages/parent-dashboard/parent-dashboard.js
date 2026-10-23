const Storage = require('../../utils/storage');
const Avail = require('../../utils/mentor-availability');
const { showToast } = require('../../utils/toast');
const appConfig = require('../../utils/config');

const BOOKING_STATUS = {
  pending_accept: { text: '待导师接单', badge: 'badge-pending' },
  escrow_locked: { text: '待导师接单', badge: 'badge-pending' },
  accepted: { text: '导师已接单', badge: 'badge-approved' },
  declined: { text: '导师已婉拒', badge: 'badge-rejected' },
  cancelled: { text: '已撤销 · 已退款', badge: 'badge-cancelled' }
};
const UNPAID_STATUS = { text: '未支付', badge: 'badge-rejected' };

function parentBookingFundCopy(b, unpaid) {
  const isTrial = b && b.type === 'trial';
  const isWeekly = b && b.type === 'weekly';
  if (unpaid) {
    return {
      fundReason: '尚未完成微信支付，资金未托管冻结。可继续付款或撤销预约。',
      amountCaption: '待支付 · 未冻结'
    };
  }
  if (b.status === 'cancelled') {
    const neverPaid = b.paymentStatus === 'unpaid' || b.escrowStatus === 'pending_payment';
    return {
      fundReason: neverPaid
        ? '约课已关闭，资金未冻结。'
        : '约课已撤销；已支付课酬已发起微信原路退款（预计 1-3 分钟到账）。',
      amountCaption: neverPaid ? '已关闭' : '已原路退款'
    };
  }
  if (b.status === 'declined') {
    const why = b.declineReason ? ('婉拒原因：' + b.declineReason + ' · ') : '';
    return {
      fundReason: why + '托管资金已自动解冻并原路退回微信。',
      amountCaption: '已解冻退回'
    };
  }
  if (b.status === 'accepted') {
    return {
      fundReason: '导师已接单，请按时上课 · 结课后 48h 无异议自动划拨。',
      amountCaption: isTrial ? '试课免费 · 托管豁免' : '课次托管冻结中'
    };
  }
  const slotExpired = Storage.bookingPendingConfirmSlotExpired && Storage.bookingPendingConfirmSlotExpired(b);
  if (slotExpired) {
    return {
      fundReason: isTrial
        ? '档期已过期，导师未确认。可撤销试课预约。'
        : (unpaid
          ? '档期已过期，导师未确认。可取消预约（未支付无需退款）。'
          : '档期已过期，导师未确认接单。可申请退款，课酬将原路退回微信。'),
      amountCaption: isTrial ? '试课·已过期' : (unpaid ? '已过期 · 未支付' : '已过期 · 可申请退款')
    };
  }
  return {
    fundReason: isTrial
      ? '试课免费，等待导师确认档期（开课前 2h 外可免费撤销）。'
      : '资金已托管冻结，等待导师确认档期（开课前 2h 外可免费撤销并原路退款）。',
    amountCaption: isTrial ? '试课免费' : (isWeekly ? '系列包提前冻结' : '已托管冻结')
  };
}

const SORT_OPTIONS = [
  { value: 'matchDesc', label: 'AI 学情契合度最高' },
  { value: 'rateAsc', label: '课酬时薪从低到高' },
  { value: 'rateDesc', label: '课酬时薪从高到低' }
];

const SPACE_FILTERS = [
  { value: '', label: '全部成都市网点' },
  { value: '青羊金沙', label: '青羊金沙微网点' },
  { value: '高新大源', label: '高新大源微网点' },
  { value: '武侯川大', label: '武侯川大望江微网点' }
];

Page({
  data: {
    parentName: '',
    studentNickname: '',
    studentGrade: '',
    cityDistrict: '',
    selectedSpace: '',
    targetGoal: '',
    budgetMin: 80,
    budgetMax: 180,
    recallCount: 0,
    tutors: [],
    topTutors: [],
    myBookings: [],
    filteredBookings: [],
    bookingFilter: 'all',
    bookingEmptyText: '暂无约课记录，预约导师后将显示接单状态。',
    bookingDateLabels: [],
    bookingDateIndex: 0,
    bookingTimes: [],
    bookingCalendar: [],
    filterSubjects: [],
    subjectFilter: '',
    spaceFilter: '',
    spaceFilterChips: [],
    searchKeyword: '',
    sortIndex: 0,
    sortOptions: SORT_OPTIONS.map((o) => o.label),
    sortLabels: SORT_OPTIONS,
    filterMin: 80,
    filterMax: 180,
    walletLabel: '资金保障 · 一课一消',
    walletFrozen: '0.00',
    walletHasFrozen: false,
    assessmentShow: false,
    assessmentSubject: '数学',
    assessmentSubjects: ['数学', '英语', '物理', '化学', '体育'],
    phoneAuthorized: false,
    phoneMasked: '',
    phoneAuthShow: false,
    privacyRead: false,
    showSmsBinding: false,
    smsPhone: '',
    smsCode: '',
    smsCooldown: 0,
    bookingShow: false,
    bookingTutor: {},
    slots: [],
    selectedSlot: '',
    selectedSlotLabel: '',
    slotsEmptyText: '',
    hours: 2,
    spaces: Storage.SPACE_OPTIONS || ['青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'],
    spaceIndex: 0,
    escrowShow: false,
    escrowAmount: '0.00',
    contractShow: false,
    contractAgreed: false,
    contractSignName: '',
    courseBadgeCount: 0,
    timeConflictShow: false,
    timeConflictMessage: '',
    pendingForceBook: false,
    passportShow: false,
    passportSubjects: [],
    passportPlans: [],
    passportBudget: '',
    passportSpace: '',
    passportGoal: '',
    iotLinkedBooking: '',
    iotBadge: 'IDLE',
    iotBadgeClass: 'badge-teal',
    iotDoorText: '门禁关闭',
    iotLightText: '灯光关闭',
    iotCountdown: '--:--:--',
    iotBtnLabel: '扫码开门 · 通电照明',
    iotBtnClass: 'btn-iot-idle',
    iotBtnDisabled: false,
    featureSmartWarehouse: !!appConfig.FEATURE_SMART_WAREHOUSE,
    settingsDrawerShow: false,
    consoleSection: 'courses'
  },

  onLoad() {
    this.setData({
      featureSmartWarehouse: !!appConfig.FEATURE_SMART_WAREHOUSE
    });
  },

  async onShow() {
    this.reload();
  },

  onUnload() {
    if (this._iotTimer) clearInterval(this._iotTimer);
    if (this._smsTimer) clearInterval(this._smsTimer);
  },

  async reload() {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    const parent = await Storage.getCurrentParent();
    if (!parent || !parent.id) {
      showToast('请先完成学情建档', 'warning');
      wx.reLaunch({ url: '/pages/parent-register/parent-register?mode=create' });
      return;
    }
    
    // Check phone authorization status
    const phone = parent.phone || '';
    const phoneAuthorized = !!phone;
    const phoneMasked = phone ? (phone.slice(0, 3) + '****' + phone.slice(7)) : '';
    
    const budgetMin = Number(parent.budgetMin) || 80;
    const budgetMax = Number(parent.budgetMax) || 180;
    let filterMin = this.data.filterMin || budgetMin;
    let filterMax = this.data.filterMax || budgetMax;
    if (!this._filterInited) {
      filterMin = budgetMin;
      filterMax = budgetMax;
      this._filterInited = true;
    }

    const allTutors = Storage.getTutorListForParent(parent);
    const subjectFilter = this.data.subjectFilter;
    const spaceFilter = this.data.spaceFilter;
    const keyword = (this.data.searchKeyword || '').trim().toLowerCase();
    const sortValue = (SORT_OPTIONS[this.data.sortIndex] || SORT_OPTIONS[0]).value;

    let tutors = allTutors.filter((t) => {
      if (t.hourlyRate < filterMin || t.hourlyRate > filterMax) return false;
      if (subjectFilter) {
        const hit = (t.subjects || []).some((s) =>
          String(s).toLowerCase().indexOf(subjectFilter.toLowerCase()) >= 0
        );
        if (!hit) return false;
      }
      if (spaceFilter) {
        if (String(t.space || '').indexOf(spaceFilter) < 0) return false;
      }
      if (keyword) {
        const hay = [
          t.maskedName, t.realName, t.university, t.degree, t.degreeShort,
          t.scoreHighlight, t.space, t.evalGrade,
          (t.subjects || []).join(' '),
          (t.styles || []).join(' '),
          (t.syllabusTopics || []).join(' ')
        ].join(' ').toLowerCase();
        if (hay.indexOf(keyword) < 0) return false;
      }
      return true;
    });

    tutors = tutors.slice().sort((a, b) => {
      if (sortValue === 'rateAsc') return a.hourlyRate - b.hourlyRate;
      if (sortValue === 'rateDesc') return b.hourlyRate - a.hourlyRate;
      return b.matchScore - a.matchScore;
    });

    const recallCount = tutors.filter((t) => t.matchScore >= 95).length;
    const topTutors = tutors.filter((t) => t.isTopMatch).slice(0, 3).map((t) =>
      Object.assign({}, t, {
        syllabusText: (t.syllabusTopics || []).slice(0, 2).join('、')
      })
    );

    const filterSubjects = [];
    (parent.subjects || []).forEach((s) => {
      if (filterSubjects.indexOf(s) < 0) filterSubjects.push(s);
    });
    ['数学', '物理', '英语', '化学', '语文', '体育', '考研', '艺考'].forEach((s) => {
      if (filterSubjects.indexOf(s) < 0) filterSubjects.push(s);
    });

    const spaceFilterChips = SPACE_FILTERS.map((f) => ({
      value: f.value,
      label: f.label,
      on: (this.data.spaceFilter || '') === f.value
    }));

    tutors = tutors.map((t) => {
      const chsi = String(t.chsiStatus || '');
      const chsiEnrolled = chsi.indexOf('有效') >= 0 || chsi.indexOf('在籍') >= 0;
      return Object.assign({}, t, {
        syllabusText: (t.syllabusTopics || []).slice(0, 3).join('、'),
        hasLecture: !!(t.lectureUrl && t.lectureUrl !== '#'),
        chsiEnrolled
      });
    });

    const bookings = Storage.getBookingsForParent(parent.id).map((b) => {
      const unpaid = !!(Storage.bookingIsUnpaid && Storage.bookingIsUnpaid(b));
      const st = unpaid
        ? UNPAID_STATUS
        : (BOOKING_STATUS[b.status] || { text: b.status, badge: 'badge-teal' });
      const sessionActions = [];
      (b.sessions || []).forEach((s) => {
        if (!s || !s.id) return;
        if (
          !unpaid &&
          b.status === 'accepted' &&
          (s.status === 'scheduled' || s.status === 'leave_too_late')
        ) {
          sessionActions.push({
            sessionId: s.id,
            label: '请假 ' + (s.date || s.timeLabel || s.timeStart || '')
          });
        }
      });
      const fund = parentBookingFundCopy(b, unpaid);
      const slotExpired = Storage.bookingPendingConfirmSlotExpired && Storage.bookingPendingConfirmSlotExpired(b);
      const sessionBadges = (b.sessions || []).map((s) => {
        const pending = b.status === 'pending_accept' || b.status === 'escrow_locked';
        let text = pending && (!s.status || s.status === 'scheduled')
          ? '待确认档期'
          : (s.status === 'scheduled' ? '已排课' : (s.status || ''));
        if (pending && slotExpired && (!s.status || s.status === 'scheduled')) text = '已过期';
        return { id: s.id, text };
      });
      const statusText = !unpaid && slotExpired ? '已过期' : st.text;
      const statusBadge = !unpaid && slotExpired ? 'badge-rejected' : st.badge;
      const cancelLabel = slotExpired ? (unpaid ? '取消预约' : '申请退款') : '撤销约课';
      return Object.assign({}, b, {
        unpaid,
        slotExpired: !!slotExpired,
        statusText,
        statusBadge,
        cancelLabel,
        canCancel: Storage.canParentCancelBooking(b),
        canPay: unpaid,
        sessionActions,
        fundReason: fund.fundReason,
        amountCaption: fund.amountCaption,
        fundWarn: !!(unpaid || b.status === 'declined'),
        sessionBadges
      });
    });
    const bookingFilter = this.data.bookingFilter || 'all';
    let filteredBookings = bookings.slice();
    if (bookingFilter === 'unpaid') {
      filteredBookings = bookings.filter((b) => b.unpaid);
    } else if (bookingFilter === 'pending') {
      filteredBookings = bookings.filter(
        (b) => !b.unpaid && (b.status === 'pending_accept' || b.status === 'escrow_locked')
      );
    } else if (bookingFilter === 'accepted') {
      filteredBookings = bookings.filter((b) => b.status === 'accepted');
    } else if (bookingFilter === 'completed') {
      filteredBookings = bookings.filter((b) =>
        (b.sessions || []).some((s) => s.status === 'completed')
      );
    } else if (bookingFilter === 'cancelled') {
      filteredBookings = bookings.filter((b) => b.status === 'cancelled');
    } else if (bookingFilter === 'declined') {
      filteredBookings = bookings.filter((b) => b.status === 'declined');
    }
    const bookingEmptyText = bookings.length === 0
      ? '暂无约课记录，预约导师后将显示接单状态。'
      : (filteredBookings.length === 0
        ? (bookingFilter === 'unpaid' ? '暂无未支付预约' : '该状态下暂无约课')
        : '');
    const courseBadgeCount = bookings.filter((b) =>
      b.unpaid || b.status === 'pending_accept' || b.status === 'escrow_locked'
    ).length;

    const wallet = Storage.getParentWalletSummary(parent);

    // IoT 关联最近 pending/accepted 约课
    const linkable = bookings.find((b) =>
      !b.unpaid && (b.status === 'accepted' || b.status === 'pending_accept')
    );
    const iotLinkedBooking = linkable
      ? (linkable.tutorName + ' · ' + (linkable.schedule || linkable.timeSlot || ''))
      : '';

    this.setData({
      parentName: parent.parentName || '家长',
      studentNickname: parent.studentNickname || '',
      studentGrade: parent.studentGrade || '',
      cityDistrict: parent.cityDistrict || '',
      selectedSpace: parent.selectedSpace || '',
      targetGoal: parent.targetGoal || '',
      budgetMin,
      budgetMax,
      filterMin,
      filterMax,
      tutors,
      topTutors,
      recallCount,
      filterSubjects,
      spaceFilterChips,
      myBookings: bookings,
      filteredBookings,
      bookingEmptyText,
      courseBadgeCount,
      parentId: parent.id,
      parentPhone: parent.phone,
      phoneAuthorized,
      phoneMasked,
      walletLabel: wallet.label,
      walletFrozen: wallet.frozenYuan.toFixed(2),
      walletHasFrozen: wallet.hasFrozen,
      iotLinkedBooking
    });
    this._parent = parent;
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value }, () => this.reload());
  },
  clearSearch() {
    this.setData({ searchKeyword: '' }, () => this.reload());
  },
  setSubjectFilter(e) {
    this.setData({ subjectFilter: e.currentTarget.dataset.v || '' }, () => this.reload());
  },
  setSpaceFilter(e) {
    this.setData({ spaceFilter: e.currentTarget.dataset.v || '' }, () => this.reload());
  },
  onSortChange(e) {
    this.setData({ sortIndex: Number(e.detail.value) }, () => this.reload());
  },
  onFilterMin(e) {
    let min = Number(e.detail.value);
    let max = this.data.filterMax;
    if (min > max - 10) min = max - 10;
    this.setData({ filterMin: min }, () => this.reload());
  },
  onFilterMax(e) {
    let max = Number(e.detail.value);
    let min = this.data.filterMin;
    if (max < min + 10) max = min + 10;
    this.setData({ filterMax: max }, () => this.reload());
  },
  resetFilters() {
    const parent = this._parent || Storage.getCurrentParent() || {};
    this.setData({
      searchKeyword: '',
      subjectFilter: '',
      spaceFilter: '',
      sortIndex: 0,
      filterMin: Number(parent.budgetMin) || 80,
      filterMax: Number(parent.budgetMax) || 180
    }, () => this.reload());
  },

  setBookingFilter(e) {
    const v = (e.currentTarget.dataset.v || 'all');
    this.setData({ bookingFilter: v }, () => this.reload());
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

  openPassport() {
    wx.navigateTo({ url: '/pages/parent-settings-passport/parent-settings-passport' });
  },
  closePassport() {
    this.setData({ passportShow: false });
  },
  updateFromPassport() {
    this.setData({ passportShow: false });
    wx.navigateTo({ url: '/pages/parent-register/parent-register?mode=edit' });
  },

  openLecture(e) {
    const url = e.currentTarget.dataset.url;
    if (!url || url === '#') {
      showToast('暂无试讲网盘链接', 'warning');
      return;
    }
    // 小程序演示：复制到剪贴板并提示
    if (wx.setClipboardData) {
      wx.setClipboardData({
        data: url,
        success: () => showToast('试讲链接已复制')
      });
    } else {
      showToast(url);
    }
  },

  _mentorAvailability() {
    const tutor = this.data.bookingTutor || {};
    const mentorId = tutor.mentorId || tutor.id;
    let availability = [];
    if (mentorId && Storage.getMentorAvailability) {
      availability = Storage.getMentorAvailability(mentorId) || [];
    }
    if ((!availability || !availability.length) && Array.isArray(tutor.availability)) {
      availability = tutor.availability;
    }
    return availability;
  },

  buildCalendar() {
    const hours = Number(this.data.hours) || 2;
    const availability = this._mentorAvailability();
    if (Avail.bookableCalendarFromAvailability && availability && availability.length) {
      return Avail.bookableCalendarFromAvailability(availability, hours, { days: 62 });
    }
    return [];
  },

  _dateLabel(day) {
    const d = day.date || (day.isoDate ? new Date(day.isoDate + 'T12:00:00') : null);
    if (!d || isNaN(d.getTime())) return day.isoDate || '';
    const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()] || '';
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return wd + ' (' + mo + '/' + da + ')';
  },

  _timeValue(isoDate, t) {
    return isoDate + '|' + t.timeStart + '-' + t.timeEnd;
  },

  openBooking(e) {
    // Check phone authorization first
    if (!this.data.phoneAuthorized) {
      showToast('预约前需要授权手机号', 'warning');
      this.setData({ 
        phoneAuthShow: true,
        privacyRead: false,
        showSmsBinding: false
      });
      return;
    }
    
    const id = e.currentTarget.dataset.id;
    const tutor = this.data.tutors.find((t) => t.mentorId === id)
      || this.data.topTutors.find((t) => t.mentorId === id);
    if (!tutor) return;
    const spaces = this.data.spaces;
    let spaceIndex = spaces.indexOf(tutor.space);
    if (spaceIndex < 0 && this._parent && this._parent.selectedSpace) {
      spaceIndex = spaces.indexOf(this._parent.selectedSpace);
    }
    if (spaceIndex < 0) spaceIndex = 0;
    this.setData({
      bookingShow: true,
      bookingTutor: tutor,
      hours: 2,
      spaceIndex,
      escrowShow: false,
      contractShow: false,
      contractAgreed: false,
      contractSignName: (this._parent && this._parent.parentName) || this.data.parentName || '',
      escrowAmount: (tutor.hourlyRate * 2).toFixed(2)
    }, () => this.refreshSlotOptions());
  },

  closeBooking() {
    this.setData({ bookingShow: false, escrowShow: false, contractShow: false, contractAgreed: false });
  },
  hideEscrow() {
    this.setData({ escrowShow: false, contractAgreed: false });
  },
  onToggleContractAgree() {
    this.setData({ contractAgreed: !this.data.contractAgreed });
  },
  onContractSign(e) {
    this.setData({ contractSignName: e.detail.value });
  },
  onSlot(e) {
    const value = e.detail.value;
    const times = this.data.bookingTimes || [];
    const meta = times.find((t) => t.value === value);
    const calendar = this.data.bookingCalendar || [];
    const day = calendar[this.data.bookingDateIndex] || {};
    this.setData({
      selectedSlot: value,
      selectedSlotLabel: meta ? (this._dateLabel(day) + ' ' + meta.label) : value
    }, () => this.refreshEscrowAmount());
  },
  onBookingDate(e) {
    const idx = Number(e.detail.value) || 0;
    this.setData({ bookingDateIndex: idx }, () => this._applyTimesForDateIndex(idx));
  },
  onHours(e) {
    this.setData({ hours: Number(e.detail.value) }, () => {
      this.refreshSlotOptions();
      this.refreshEscrowAmount();
    });
  },
  _applyTimesForDateIndex(idx, prevSlot) {
    const calendar = this.data.bookingCalendar || [];
    const day = calendar[idx] || calendar[0];
    if (!day) {
      this.setData({ bookingTimes: [], selectedSlot: '', slots: [] });
      return;
    }
    const times = (day.times || []).map((t) => ({
      value: this._timeValue(day.isoDate, t),
      label: t.label || (t.timeStart + ' – ' + t.timeEnd),
      isoDate: day.isoDate,
      weekday: day.weekday,
      timeStart: t.timeStart,
      timeEnd: t.timeEnd
    }));
    const keep = times.some((t) => t.value === prevSlot);
    const selected = keep ? prevSlot : (times[0] ? times[0].value : '');
    const selectedMeta = times.find((t) => t.value === selected);
    const dateLabel = this._dateLabel(day);
    this.setData({
      bookingTimes: times,
      slots: times,
      selectedSlot: selected,
      selectedSlotLabel: selectedMeta ? (dateLabel + ' ' + selectedMeta.label) : ''
    });
  },
  refreshSlotOptions() {
    const calendar = this.buildCalendar();
    const prev = this.data.selectedSlot;
    const prevIso = prev && String(prev).indexOf('|') >= 0 ? String(prev).split('|')[0] : '';
    let idx = calendar.findIndex((d) => d.isoDate === prevIso);
    if (idx < 0) idx = 0;
    const labels = calendar.map((d) => this._dateLabel(d) + ' · ' + (d.times || []).length + ' 个时段');
    const emptyText = calendar.length
      ? ''
      : '当前时长无法落入该导师可约窗口，请改为 1 小时或更换导师';
    this.setData({
      bookingCalendar: calendar,
      bookingDateLabels: labels,
      bookingDateIndex: idx,
      slotsEmptyText: emptyText
    }, () => this._applyTimesForDateIndex(idx, prev));
  },
  onBookSpace(e) {
    this.setData({ spaceIndex: Number(e.detail.value) });
  },
  refreshEscrowAmount() {
    const rate = Number(this.data.bookingTutor.hourlyRate) || 0;
    const hours = Number(this.data.hours) || 2;
    this.setData({ escrowAmount: (rate * hours).toFixed(2) });
  },
  showEscrow() {
    if (!this.data.selectedSlot) {
      showToast('请选择预约时段', 'warning');
      return;
    }
    this.refreshEscrowAmount();
    this.setData({ escrowShow: true });
    showToast('托管锁定摘要已生成');
  },

  _sessionsFromSlot(slot, hours) {
    const raw = String(slot || '');
    let isoDate = '';
    let rest = raw;
    if (raw.indexOf('|') >= 0) {
      isoDate = raw.split('|')[0];
      rest = raw.split('|')[1] || '';
    }
    const m = rest.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
      || raw.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    const pad = (t) => {
      const p = String(t || '').split(':');
      return String(p[0] || '0').padStart(2, '0') + ':' + String(p[1] || '00').padStart(2, '0');
    };
    const timeStart = pad(m ? m[1] : '14:00');
    let timeEnd = pad(m ? m[2] : timeStart);
    if (hours && Avail.timeToMinutes) {
      const startMins = Avail.timeToMinutes(timeStart);
      timeEnd = Avail.minutesToTime(startMins + Math.max(1, Number(hours) || 2) * 60);
    }
    let weekday = '';
    if (isoDate) {
      weekday = new Date(isoDate + 'T12:00:00').getDay();
    }
    const wdNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return [{
      date: isoDate,
      weekday,
      weekdayLabel: weekday === '' ? '' : (wdNames[weekday] || ''),
      timeStart,
      timeEnd,
      timeLabel: timeStart + '-' + timeEnd
    }];
  },

  closeTimeConflict() {
    this.setData({ timeConflictShow: false, pendingForceBook: false });
  },

  forceBookAfterConflict() {
    this.setData({ timeConflictShow: false, pendingForceBook: true }, () => this.confirmBook());
  },

  async confirmBook() {
    const tutor = this.data.bookingTutor;
    const parent = this._parent && this._parent.id
      ? this._parent
      : await Storage.getCurrentParent();
    if (!parent || !parent.id) {
      showToast('请先完成学情建档', 'warning');
      return;
    }
    this._parent = parent;
    const hours = Number(this.data.hours) || 2;
    const space = this.data.spaces[this.data.spaceIndex];
    const slot = this.data.selectedSlot;
    if (!slot) {
      showToast('请选择导师可约时段', 'warning');
      return;
    }
    const sessions = this._sessionsFromSlot(slot, hours);
    const sess0 = sessions[0] || {};
    const scheduleLabel = (sess0.weekdayLabel || '') +
      (sess0.date ? ' ' + sess0.date : '') +
      ' ' + (sess0.timeLabel || slot);
    const mentorId = tutor.mentorId || tutor.id;
    if (Storage.sessionFitsMentorAvailability && !Storage.sessionFitsMentorAvailability(mentorId, sessions, tutor.availability)) {
      showToast('所选时段不在导师可约时间内，请调整时间或更换导师', 'error');
      return;
    }
    if (!this.data.escrowShow) {
      this.showEscrow();
      return;
    }
    if (!this.data.contractAgreed) {
      showToast('请勾选同意《三方托管服务居间协议》', 'warning');
      return;
    }
    const signName = String(this.data.contractSignName || '').trim();
    if (!signName || signName.length < 2) {
      showToast('请输入电子签名姓名', 'warning');
      return;
    }

    const booking = await Storage.addBooking({
      mentorId: tutor.mentorId,
      tutorId: tutor.mentorId,
      tutorName: tutor.maskedName,
      parentId: parent.id,
      parentName: parent.parentName,
      parentPhone: parent.phone,
      studentNickname: parent.studentNickname,
      studentGrade: parent.studentGrade,
      subject: (tutor.subjects && tutor.subjects[0]) || '辅导',
      space,
      schedule: scheduleLabel.trim(),
      timeSlot: scheduleLabel.trim(),
      hours,
      sessions,
      timeConflictForced: this.data.pendingForceBook || undefined,
      status: 'pending_accept'
    });

    if (booking && booking.code === 'STUDENT_TIME_CONFLICT' && !this.data.pendingForceBook) {
      this.setData({
        timeConflictShow: true,
        timeConflictMessage: booking.error || '与学员其他课程时间冲突'
      });
      return;
    }
    this.setData({ pendingForceBook: false });

    if (!booking || !booking.id) {
      showToast((booking && booking.error) || '预约创建失败', 'error');
      return;
    }

    const amount = Number(booking.amount) || 0;

    try {
      await Storage.saveContract({
        bookingId: booking.id,
        title: '三方托管服务居间协议',
        signer: signName,
        tutorName: tutor.maskedName,
        amount,
        space,
        rule: '课后48小时无异议自动解冻划拨（导师92%/平台8%）'
      });
    } catch (error) {
      console.error('[Contract Error]', error);
      showToast('合约保存失败', 'error');
      return;
    }

    let paymentOk = amount <= 0;
    if (amount > 0) {
      paymentOk = await this.handleWeChatPayment(
        booking.id,
        amount,
        tutor.maskedName,
        (tutor.subjects && tutor.subjects[0]) || '辅导'
      );
    }

    if (!paymentOk) {
      showToast('尚未完成支付，预约已保存为「未支付」，可在我的约课中继续付款或撤销', 'warning');
      this.setData({
        bookingShow: false,
        contractShow: false,
        escrowShow: false,
        bookingFilter: 'unpaid'
      });
      this.reload();
      return;
    }

    this.setData({
      bookingShow: false,
      contractShow: false,
      escrowShow: false,
      iotLinkedBooking: (tutor.maskedName || '') + ' · ' + slot
    });

    showToast(
      this.data.featureSmartWarehouse
        ? '约课成功 · 托管已锁定，可关联 IoT 履约面板'
        : '约课成功，等待导师接单'
    );
    this.reload();
    if (this.data.featureSmartWarehouse) {
      this.setIoTState('idle');
    }
  },

  async handleWeChatPayment(bookingId, amount, tutorName, subject) {
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
      const payMode = config.PAY_MODE || 'demo';

      // 创建预支付订单
      const prepayResult = await Storage.prepayWechat(
        bookingId,
        amount,
        `星火学伴 · ${subject} · ${tutorName}`
      );

      if (!prepayResult.success || prepayResult.error) {
        showToast(prepayResult.error || '支付订单创建失败', 'error');
        console.error('Prepay failed:', prepayResult);
        return false;
      }

      if (prepayResult.mock) {
        const confirmResult = await Storage.mockConfirmPayment(prepayResult.outTradeNo);
        return !!(confirmResult && confirmResult.success);
      }

      if (!prepayResult.prepayId) {
        showToast('支付参数不完整，请检查服务端微信支付配置', 'error');
        return false;
      }

      const payParams = {
        timeStamp: prepayResult.timeStamp,
        nonceStr: prepayResult.nonceStr,
        package: prepayResult.package,
        signType: prepayResult.signType || 'RSA',
        paySign: prepayResult.paySign
      };

      if (!payParams.timeStamp || !payParams.paySign) {
        showToast('支付参数不完整，请检查服务端微信支付配置', 'error');
        return false;
      }

      const outTradeNo = prepayResult.outTradeNo;
      return new Promise((resolve) => {
        wx.requestPayment({
          ...payParams,
          success: async () => {
            showToast('正在确认支付结果…');
            const synced = await Storage.waitForPaymentConfirmed(outTradeNo, { maxMs: 90000 });
            if (synced && synced.success) {
              showToast('✓ 支付成功');
              this.reload();
              resolve(true);
              return;
            }
            showToast((synced && synced.error) || '支付尚未确认', 'warning');
            resolve(false);
          },
          fail: (err) => {
            const msg = (err && err.errMsg) || '';
            if (msg.includes('cancel')) {
              showToast('支付已取消', 'warning');
            } else {
              showToast('支付失败，请重试', 'error');
            }
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('WeChat payment error:', error);
      showToast('支付处理异常，请稍后重试', 'error');
      return false;
    }
  },

  setIoTState(state) {
    if (state === 'opened') {
      this.setData({
        iotBadge: 'DOOR-OPEN',
        iotBadgeClass: 'badge-approved',
        iotDoorText: '门禁已开',
        iotLightText: '灯光已通',
        iotBtnLabel: '已开门 · 灯光已通',
        iotBtnClass: 'btn-iot-opened',
        iotBtnDisabled: true
      });
    } else if (state === 'poweredOff') {
      this.setData({
        iotBadge: 'FORCE-OFF',
        iotBadgeClass: 'badge-rejected',
        iotDoorText: '门禁锁定',
        iotLightText: '已强制断电',
        iotCountdown: '00:00:00',
        iotBtnLabel: '已收课断电',
        iotBtnClass: 'btn-iot-off',
        iotBtnDisabled: true
      });
    } else {
      this.setData({
        iotBadge: 'IDLE',
        iotBadgeClass: 'badge-teal',
        iotDoorText: '门禁关闭',
        iotLightText: '灯光关闭',
        iotBtnLabel: '扫码开门 · 通电照明',
        iotBtnClass: 'btn-iot-idle',
        iotBtnDisabled: false
      });
    }
  },

  simulateIoT() {
    if (this.data.iotBtnDisabled) return;
    if (!this.data.iotLinkedBooking) {
      showToast('请先完成约课后再关联 IoT 开门', 'warning');
      return;
    }
    this.setIoTState('opened');
    showToast('扫码成功：门禁开启 · 通风照明已接通');
    if (this._iotTimer) clearInterval(this._iotTimer);
    const tick = () => {
      const now = new Date();
      let target = new Date(now);
      target.setHours(20, 30, 0, 0);
      if (now >= target) {
        target = new Date(now.getTime() + 15000);
      }
      const diff = target - now;
      if (diff <= 0) {
        clearInterval(this._iotTimer);
        this._iotTimer = null;
        this.setIoTState('poweredOff');
        showToast('已到 20:30，系统强制断电收课', 'warning');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const p = (n) => String(n).padStart(2, '0');
      this.setData({ iotCountdown: p(h) + ':' + p(m) + ':' + p(s) });
    };
    tick();
    this._iotTimer = setInterval(tick, 1000);
  },

  goLogin() {
    this.closeSettingsDrawer();
    Storage.clearSession();
    wx.reLaunch({ url: '/pages/login/login' });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  /* ========== Phone Authorization for Booking ========== */
  onTogglePrivacyRead() {
    this.setData({ privacyRead: !this.data.privacyRead });
  },

  goPrivacyPage(e) {
    e.stopPropagation();
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  closePhoneAuth() {
    this.setData({ phoneAuthShow: false });
  },

  async onWechatPhoneAuth(e) {
    console.log('[WeChat Phone Auth]', e);
    
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      showToast('已取消授权', 'warning');
      
      // Record audit log for denial
      try {
        await Storage.auditLog('authorize_deny', 'wechat_auth_booking', false);
      } catch (error) {
        console.error('[Audit Log Error]', error);
      }
      
      return;
    }

    const code = e.detail.code;
    
    try {
      const result = await Storage.getWeChatPhone(code);

      if (result.success) {
        // Update parent profile with phone
        const parent = this._parent || Storage.getCurrentParent();
        if (parent) {
          parent.phone = result.phone;
          Storage.saveParent(parent);
        }
        
        this.setData({
          phoneAuthorized: true,
          phoneMasked: result.masked || (result.phone.slice(0, 3) + '****' + result.phone.slice(7)),
          phoneAuthShow: false,
          parentPhone: result.phone
        });
        
        showToast('手机号授权成功');
        
        // Bind phone to account if logged in
        if (Storage.isLoggedIn()) {
          await this.bindPhoneToAccount(result.phone, 'wechat_auth_booking');
        }
      } else {
        showToast(result.error || '获取手机号失败', 'error');
      }
    } catch (error) {
      console.error('[WeChat Phone Auth Error]', error);
      showToast('授权失败，请使用手动输入方式', 'warning');
      this.setData({ showSmsBinding: true });
    }
  },

  onShowSmsBinding() {
    this.setData({ showSmsBinding: !this.data.showSmsBinding });
  },

  onSmsPhone(e) {
    this.setData({ smsPhone: e.detail.value });
  },

  onSmsCode(e) {
    this.setData({ smsCode: e.detail.value });
  },

  async onSendSmsCode() {
    const phone = (this.data.smsPhone || '').trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      showToast('请输入有效的11位手机号', 'warning');
      return;
    }

    if (this.data.smsCooldown > 0) return;

    try {
      const result = await Storage.sendSMS(phone, 'bind');

      if (result.success) {
        const msg = result.message || '验证码已发送，请查收';
        showToast(msg);

        this.setData({ smsCooldown: 60 });
        if (this._smsTimer) clearInterval(this._smsTimer);
        this._smsTimer = setInterval(() => {
          const n = this.data.smsCooldown - 1;
          if (n <= 0) {
            clearInterval(this._smsTimer);
            this.setData({ smsCooldown: 0 });
          } else {
            this.setData({ smsCooldown: n });
          }
        }, 1000);
      } else {
        showToast(result.error || '发送失败', 'error');
      }
    } catch (error) {
      console.error('[SMS Send Error]', error);
      showToast('发送失败，请稍后重试', 'warning');
    }
  },

  async onVerifySmsCode() {
    const phone = (this.data.smsPhone || '').trim();
    const code = (this.data.smsCode || '').trim();

    if (!phone || !code) {
      showToast('请输入手机号和验证码', 'warning');
      return;
    }

    try {
      const result = await Storage.verifySMS(phone, code, 'bind');

      if (result.success) {
        const masked = phone.slice(0, 3) + '****' + phone.slice(7);
        
        // Update parent profile with phone
        const parent = this._parent || Storage.getCurrentParent();
        if (parent) {
          parent.phone = phone;
          Storage.saveParent(parent);
        }
        
        this.setData({
          phoneAuthorized: true,
          phoneMasked: masked,
          phoneAuthShow: false,
          showSmsBinding: false,
          smsPhone: '',
          smsCode: '',
          parentPhone: phone
        });

        showToast('手机号验证成功');
        
        // Bind phone to account if logged in
        if (Storage.isLoggedIn()) {
          await this.bindPhoneToAccount(phone, 'sms_verify_booking');
        }
      } else {
        showToast(result.error || '验证失败', 'error');
      }
    } catch (error) {
      console.error('[SMS Verify Error]', error);
      showToast('验证失败，请重试', 'error');
    }
  },

  async bindPhoneToAccount(phone, source) {
    try {
      const result = await Storage.bindPhone(phone, source);
      if (result.success) {
        console.log('[Phone Bind Success]', result);
      } else {
        console.error('[Phone Bind Failed]', result.error);
      }
    } catch (error) {
      console.error('[Phone Bind Error]', error);
    }
  },

  goAssessment() {
    wx.navigateTo({ url: '/pages/parent-settings-assessment/parent-settings-assessment' });
  },

  closeAssessment() {
    this.setData({ assessmentShow: false });
  },

  onAssessmentSubject(e) {
    this.setData({ assessmentSubject: e.currentTarget.dataset.v || '数学' });
  },

  async submitQuickAssessment() {
    const parent = this._parent || Storage.getCurrentParent();
    if (!parent) return;
    const subject = this.data.assessmentSubject || '数学';
    await Storage.saveAssessment({
      parentId: parent.id,
      studentNickname: parent.studentNickname,
      studentGrade: parent.studentGrade,
      subject,
      source: 'miniprogram_quick',
      selfReportLevel: '待完善',
      note: '小程序快捷测评入口登记'
    });
    this.setData({ assessmentShow: false });
    showToast('测评意向已登记，请按导师要求完成详细测评');
  },

  async onResumePay(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const booking = (this.data.myBookings || []).find((b) => b.id === id)
      || Storage.getBookingById(id);
    if (!booking) {
      showToast('预约不存在', 'error');
      return;
    }
    const tutorName = booking.tutorName || '导师';
    const subject = booking.subject || '辅导';
    const amount = Number(booking.amount) || 0;
    if (amount <= 0) {
      showToast('该预约无需支付');
      return;
    }
    const ok = await this.handleWeChatPayment(booking.id, amount, tutorName, subject);
    if (ok) {
      showToast('支付成功，托管已锁定，等待导师接单');
    } else {
      showToast('尚未完成支付，可稍后继续', 'warning');
    }
    this.reload();
  },

  async onCancelBooking(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const that = this;
    const list = Storage.getBookings();
    const raw = list.find((b) => b.id === id);
    const slotExpired = raw && Storage.bookingPendingConfirmSlotExpired && Storage.bookingPendingConfirmSlotExpired(raw);
    const unpaid = raw && Storage.bookingIsUnpaid && Storage.bookingIsUnpaid(raw);
    const title = slotExpired ? (unpaid ? '取消预约' : '申请退款') : '撤销约课';
    const content = slotExpired
      ? (unpaid
        ? '档期已过期且导师未确认，确认取消该预约？'
        : '档期已过期且导师未确认，确认申请退款？课酬将原路退回微信。')
      : '开课前 2 小时外可撤销并退回托管。确认撤销？';
    wx.showModal({
      title,
      content,
      success(res) {
        if (!res.confirm) return;
        Storage.cancelParentBooking(id).then((r) => {
          if (r && r.ok) {
            const msg = r.refund && r.refund.outTradeNo
              ? '约课已撤销，课酬将原路退回微信'
              : '约课已撤销';
            showToast(msg);
            that.reload();
          } else {
            showToast((r && r.error) || '撤销失败', 'warning');
          }
        });
      }
    });
  },

  async onRequestLeave(e) {
    const bookingId = e.currentTarget.dataset.bid;
    const sessionId = e.currentTarget.dataset.sid;
    if (!bookingId || !sessionId) return;
    const result = await Storage.requestSessionLeave(bookingId, sessionId, 'parent');
    if (result && result.ok !== false) {
      showToast('已提交请假（须提前一日确认）');
      this.reload();
    } else {
      showToast((result && result.error) || '请假失败', 'warning');
    }
  }
});
