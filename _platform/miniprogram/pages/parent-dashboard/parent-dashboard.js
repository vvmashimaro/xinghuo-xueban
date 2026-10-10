const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

const SUBJECT_CHIPS = [
  { value: '', label: '全部' },
  { value: '数学', label: '数学' },
  { value: '物理', label: '物理' },
  { value: '英语', label: '英语' },
  { value: '考研', label: '考研' },
  { value: '体育', label: '体育/艺体' }
];

const SPACE_CHIPS = [
  { value: '', label: '全部网点' },
  { value: '青羊金沙', label: '青羊金沙' },
  { value: '高新大源', label: '高新大源' },
  { value: '武侯川大', label: '武侯川大' }
];

const SORT_LABELS = ['契合度最高', '时薪从低到高', '时薪从高到低'];
const BOOKING_TABS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待接单' },
  { value: 'accepted', label: '已接单' },
  { value: 'completed', label: '已完课' }
];

const STATUS_MAP = {
  pending_accept: { text: '待导师接单', badge: 'badge-pending' },
  escrow_locked: { text: '托管已锁', badge: 'badge-pending' },
  accepted: { text: '已接单', badge: 'badge-approved' },
  completed: { text: '已完课', badge: 'badge-approved' },
  declined: { text: '已婉拒', badge: 'badge-rejected' }
};

Page({
  data: {
    ready: false,
    hubTab: 'match',
    studentNickname: '',
    gradeBadge: '',
    cityDistrict: '',
    matchHint: '',
    keyword: '',
    subjectFilter: '',
    spaceFilter: '',
    sortIndex: 0,
    sortLabels: SORT_LABELS,
    subjectChips: [],
    spaceChips: [],
    tutors: [],
    bookingTab: 'all',
    bookingTabs: [],
    bookings: [],
    bookShow: false,
    bookTutor: {},
    slotLabels: Storage.DEFAULT_SLOTS,
    slotIndex: 0,
    hourOptions: ['1 小时', '2 小时', '3 小时'],
    hourIndex: 1,
    spaces: Storage.SPACE_OPTIONS,
    spaceIndex: 0,
    boothChips: [],
    escrowAmount: '0',
    conflictShow: false,
    conflictMsg: '',
    forceNext: false
  },

  _parent: null,

  onShow() {
    this.bootstrap();
  },

  async bootstrap() {
    if (!Storage.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    if (Storage.ready) await Storage.ready();
    await Storage.hydrateFromServer();
    Storage.seedIfEmpty();
    const parent = Storage.getCurrentParent();
    if (!parent) {
      wx.reLaunch({ url: '/pages/parent-register/parent-register?mode=create' });
      return;
    }
    this._parent = parent;
    this.refreshLists();
    this.setData({
      ready: true,
      studentNickname: parent.studentNickname || '学员',
      gradeBadge: (parent.studentGrade || '').split(' ')[0] || '学员',
      cityDistrict: parent.cityDistrict || '',
      matchHint: (parent.subjects || []).slice(0, 3).join('/') || parent.studentGrade || '学情画像',
      spaces: Storage.SPACE_OPTIONS
    });
  },

  refreshLists() {
    const parent = this._parent;
    const keyword = (this.data.keyword || '').trim().toLowerCase();
    const subjectFilter = this.data.subjectFilter;
    const spaceFilter = this.data.spaceFilter;
    const sortIndex = this.data.sortIndex;

    let tutors = Storage.getTutorListForParent(parent);
    tutors = tutors.filter((t) => {
      if (subjectFilter) {
        const hit = (t.subjects || []).some((s) => String(s).indexOf(subjectFilter) >= 0);
        if (!hit) return false;
      }
      if (spaceFilter && String(t.space || '').indexOf(spaceFilter) < 0) return false;
      if (keyword) {
        const hay = [t.maskedName, t.university, (t.subjects || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(keyword) < 0) return false;
      }
      return true;
    });
    tutors.sort((a, b) => {
      if (sortIndex === 1) return a.hourlyRate - b.hourlyRate;
      if (sortIndex === 2) return b.hourlyRate - a.hourlyRate;
      return b.matchScore - a.matchScore;
    });
    tutors = tutors.map((t) => Object.assign({}, t, {
      syllabusText: (t.syllabusTopics || []).slice(0, 3).join('、') || (t.styles || []).join('、')
    }));

    const rawBookings = Storage.getBookingsForParent(parent.id);
    const tab = this.data.bookingTab;
    const bookings = rawBookings
      .filter((b) => {
        if (tab === 'all') return true;
        if (tab === 'pending') return b.status === 'pending_accept' || b.status === 'escrow_locked';
        if (tab === 'accepted') return b.status === 'accepted';
        if (tab === 'completed') return b.status === 'completed';
        return true;
      })
      .map((b) => {
        const st = STATUS_MAP[b.status] || { text: b.status, badge: 'badge-pending' };
        return Object.assign({}, b, {
          statusText: st.text,
          statusBadge: st.badge,
          hasTimeConflict: !!b.timeConflictNote || b.hasTimeConflict,
          timeConflictForced: !!b.timeConflictForced
        });
      });

    this.setData({
      tutors,
      bookings,
      subjectChips: SUBJECT_CHIPS.map((c) => ({
        value: c.value,
        label: c.label,
        on: c.value === this.data.subjectFilter
      })),
      spaceChips: SPACE_CHIPS.map((c) => ({
        value: c.value,
        label: c.label,
        on: c.value === this.data.spaceFilter
      })),
      bookingTabs: BOOKING_TABS.map((c) => ({
        value: c.value,
        label: c.label,
        on: c.value === this.data.bookingTab
      }))
    });
  },

  setHub(e) {
    this.setData({ hubTab: e.currentTarget.dataset.tab }, () => this.refreshLists());
  },
  onKeyword(e) {
    this.setData({ keyword: e.detail.value }, () => this.refreshLists());
  },
  setSubject(e) {
    this.setData({ subjectFilter: e.currentTarget.dataset.v || '' }, () => this.refreshLists());
  },
  setSpace(e) {
    this.setData({ spaceFilter: e.currentTarget.dataset.v || '' }, () => this.refreshLists());
  },
  onSort(e) {
    this.setData({ sortIndex: Number(e.detail.value) }, () => this.refreshLists());
  },
  setBookingTab(e) {
    this.setData({ bookingTab: e.currentTarget.dataset.v || 'all' }, () => this.refreshLists());
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/parent-register/parent-register?mode=edit' });
  },
  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  openBook(e) {
    const id = e.currentTarget.dataset.id;
    const tutor = this.data.tutors.find((t) => t.mentorId === id);
    if (!tutor) return;
    const spaces = this.data.spaces;
    let spaceIndex = spaces.indexOf(tutor.space);
    if (spaceIndex < 0) spaceIndex = 0;
    const boothChips = this._boothChipsForSpace(spaces[spaceIndex]);
    const rate = tutor.hourlyRate || 0;
    this.setData({
      bookShow: true,
      bookTutor: tutor,
      spaceIndex,
      slotIndex: 0,
      hourIndex: 1,
      boothChips,
      escrowAmount: (rate * 2).toFixed(2),
      forceNext: false
    });
  },

  _boothChipsForSpace(space) {
    const opts = Storage.getBoothOptionsForSpace(space);
    return opts.map((b, i) => ({
      id: b.id,
      label: b.label,
      on: i === 0
    }));
  },

  closeBook() { this.setData({ bookShow: false }); },
  closeConflict() { this.setData({ conflictShow: false, forceNext: false }); },
  noop() {},

  onSlot(e) { this.setData({ slotIndex: Number(e.detail.value) }, () => this._refreshEscrow()); },
  onHours(e) { this.setData({ hourIndex: Number(e.detail.value) }, () => this._refreshEscrow()); },
  onBookSpace(e) {
    const spaceIndex = Number(e.detail.value);
    const space = this.data.spaces[spaceIndex];
    this.setData({
      spaceIndex,
      boothChips: this._boothChipsForSpace(space)
    });
  },
  setBooth(e) {
    const id = e.currentTarget.dataset.id || '';
    const label = e.currentTarget.dataset.label || '';
    const boothChips = this.data.boothChips.map((b) => Object.assign({}, b, { on: b.id === id && b.label === label }));
    this.setData({ boothChips, selectedBoothId: id, selectedBoothLabel: label });
  },

  _refreshEscrow() {
    const hours = Number(this.data.hourOptions[this.data.hourIndex].split(' ')[0]) || 2;
    const rate = Number(this.data.bookTutor.hourlyRate) || 0;
    this.setData({ escrowAmount: (rate * hours).toFixed(2) });
  },

  forceBook() {
    this.setData({ conflictShow: false, forceNext: true, bookShow: true }, () => this.confirmBook());
  },

  async confirmBook() {
    const parent = this._parent;
    const tutor = this.data.bookTutor;
    const hours = Number(this.data.hourOptions[this.data.hourIndex].split(' ')[0]) || 2;
    const space = this.data.spaces[this.data.spaceIndex];
    const slot = this.data.slotLabels[this.data.slotIndex];
    const booth = (this.data.boothChips || []).find((b) => b.on) || { id: '', label: '' };

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
      schedule: slot,
      timeSlot: slot,
      hours,
      boothId: booth.id || undefined,
      boothLabel: booth.label || undefined,
      timeConflictForced: this.data.forceNext || undefined,
      status: 'pending_accept'
    });

    if (booking && !booking.id && booking.code === 'STUDENT_TIME_CONFLICT' && !this.data.forceNext) {
      this.setData({
        conflictShow: true,
        conflictMsg: booking.error || '与学员其他课程时间冲突',
        bookShow: false
      });
      return;
    }

    if (!booking || !booking.id) {
      showToast((booking && booking.error) || '预约失败', 'error');
      return;
    }

    const amount = Number(booking.amount) || 0;
    await Storage.saveContract({
      bookingId: booking.id,
      title: '三方托管服务居间协议',
      signer: parent.parentName,
      tutorName: tutor.maskedName,
      amount,
      space,
      rule: '课后48小时无异议自动解冻'
    });

    if (amount > 0) {
      const prepay = await Storage.prepayWechat(booking.id, amount, tutor.maskedName + ' · ' + (tutor.subjects[0] || ''));
      if (prepay && prepay.mock && prepay.outTradeNo) {
        await Storage.mockConfirmPayment(prepay.outTradeNo);
      }
    }

    showToast('约课已提交，待导师接单');
    this.setData({ bookShow: false, forceNext: false, hubTab: 'bookings' });
    await Storage.hydrateFromServer();
    this.bootstrap();
  }
});
