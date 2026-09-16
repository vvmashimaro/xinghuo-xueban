const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

const BOOKING_STATUS = {
  pending_accept: { text: '待导师接单', badge: 'badge-pending' },
  escrow_locked: { text: '托管已锁', badge: 'badge-pending' },
  accepted: { text: '已接单', badge: 'badge-approved' },
  declined: { text: '已婉拒', badge: 'badge-rejected' }
};

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
    walletAvailable: '315.00',
    walletFrozen: '135.00',
    bookingShow: false,
    bookingTutor: {},
    slots: [],
    selectedSlot: '',
    hours: 2,
    spaces: Storage.SPACE_OPTIONS || ['青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'],
    spaceIndex: 0,
    escrowShow: false,
    escrowAmount: '0.00',
    contractShow: false,
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
    iotBtnLabel: '模拟扫码开门 · 通电照明',
    iotBtnClass: 'btn-iot-idle',
    iotBtnDisabled: false
  },

  async onShow() {
    this.reload();
  },

  onUnload() {
    if (this._iotTimer) clearInterval(this._iotTimer);
  },

  reload() {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    const parent = Storage.getCurrentParent();
    if (!parent) {
      showToast('请先完成学情建档', 'warning');
      wx.reLaunch({ url: '/pages/parent-register/parent-register?mode=create' });
      return;
    }
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
    ['数学', '物理', '英语', '化学', '语文', '艺考'].forEach((s) => {
      if (filterSubjects.indexOf(s) < 0) filterSubjects.push(s);
    });

    const spaceFilterChips = SPACE_FILTERS.map((f) => ({
      value: f.value,
      label: f.label,
      on: (this.data.spaceFilter || '') === f.value
    }));

    tutors = tutors.map((t) =>
      Object.assign({}, t, {
        syllabusText: (t.syllabusTopics || []).slice(0, 3).join('、'),
        hasLecture: !!(t.lectureUrl && t.lectureUrl !== '#')
      })
    );

    const bookings = Storage.getBookingsForParent(parent.id).map((b) => {
      const st = BOOKING_STATUS[b.status] || { text: b.status, badge: 'badge-teal' };
      return Object.assign({}, b, { statusText: st.text, statusBadge: st.badge });
    });

    // 冻结金额示意：取待接单/已接单金额合计的演示值
    let frozen = 0;
    bookings.forEach((b) => {
      if (b.status === 'pending_accept' || b.status === 'accepted' || b.status === 'escrow_locked') {
        frozen += Number(b.amount) || 0;
      }
    });
    const walletFrozen = frozen > 0 ? frozen.toFixed(2) : '135.00';
    const walletAvailable = Math.max(0, 450 - Number(walletFrozen)).toFixed(2);

    // IoT 关联最近 pending/accepted 约课
    const linkable = bookings.find((b) => b.status === 'accepted' || b.status === 'pending_accept');
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
      parentId: parent.id,
      parentPhone: parent.phone,
      walletAvailable,
      walletFrozen,
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

  goEditProfile() {
    wx.navigateTo({ url: '/pages/parent-register/parent-register?mode=edit' });
  },

  openPassport() {
    const parent = this._parent || Storage.getCurrentParent();
    if (!parent) return;
    const plans = parent.subjectPlans || {};
    const subjects = parent.subjects || Object.keys(plans);
    const passportPlans = subjects.map((name) => {
      const plan = plans[name] || {};
      return {
        name,
        weakPoints: (plan.weakPoints || []).join('、') || '未标注',
        pacing: plan.pacing || parent.pacingMode || '未设',
        pains: (plan.pains || []).join('、') || '未标注'
      };
    });
    this.setData({
      passportShow: true,
      passportSubjects: subjects,
      passportPlans,
      passportBudget: '¥' + (parent.budgetMin || 80) + '–' + (parent.budgetMax || 180) + '/小时',
      passportSpace: parent.selectedSpace || '',
      passportGoal: parent.targetGoal || ''
    });
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

  buildSlots() {
    const slots = (Storage.DEFAULT_SLOTS || [
      '周六 09:00-11:00',
      '周六 14:00-16:00',
      '周日 09:00-11:00',
      '周日 19:00-21:00',
      '周三 19:00-21:00'
    ]).map((s) => ({ value: s, label: s }));
    return slots;
  },

  openBooking(e) {
    const id = e.currentTarget.dataset.id;
    const tutor = this.data.tutors.find((t) => t.mentorId === id)
      || this.data.topTutors.find((t) => t.mentorId === id);
    if (!tutor) return;
    const slots = this.buildSlots();
    const spaces = this.data.spaces;
    let spaceIndex = spaces.indexOf(tutor.space);
    if (spaceIndex < 0 && this._parent && this._parent.selectedSpace) {
      spaceIndex = spaces.indexOf(this._parent.selectedSpace);
    }
    if (spaceIndex < 0) spaceIndex = 0;
    this.setData({
      bookingShow: true,
      bookingTutor: tutor,
      slots,
      selectedSlot: slots[0].value,
      hours: 2,
      spaceIndex,
      escrowShow: false,
      escrowAmount: (tutor.hourlyRate * 2).toFixed(2)
    });
  },

  closeBooking() {
    this.setData({ bookingShow: false, escrowShow: false, contractShow: false });
  },
  onSlot(e) {
    this.setData({ selectedSlot: e.detail.value }, () => this.refreshEscrowAmount());
  },
  onHours(e) {
    this.setData({ hours: Number(e.detail.value) }, () => this.refreshEscrowAmount());
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
  openContract() {
    this.setData({ contractShow: true });
  },
  closeContract() {
    this.setData({ contractShow: false });
  },

  confirmBook() {
    const tutor = this.data.bookingTutor;
    const parent = this._parent || Storage.getCurrentParent();
    const hours = Number(this.data.hours) || 2;
    const amount = Number(this.data.escrowAmount) || tutor.hourlyRate * hours;
    const space = this.data.spaces[this.data.spaceIndex];
    const slot = this.data.selectedSlot;

    Storage.saveContract({
      parentId: parent.id,
      mentorId: tutor.mentorId,
      amount,
      hours,
      space,
      schedule: slot,
      rule: '课后48小时无异议自动解冻划拨（导师92%/平台8%）'
    });

    const booking = Storage.addBooking({
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
      schedule: slot,
      timeSlot: slot,
      amount,
      hours,
      status: 'pending_accept'
    });

    this.setData({
      bookingShow: false,
      contractShow: false,
      escrowShow: false,
      iotLinkedBooking: (tutor.maskedName || '') + ' · ' + slot
    });
    showToast('约课成功 · 托管已锁定，可关联 IoT 履约面板');
    this.reload();
    // 约课后重置 IoT 为可操作，便于演示开门
    this.setIoTState('idle');
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
        iotBtnLabel: '模拟扫码开门 · 通电照明',
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
    Storage.clearSession();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
