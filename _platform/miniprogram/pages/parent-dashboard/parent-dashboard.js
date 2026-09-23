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
    if (this._smsTimer) clearInterval(this._smsTimer);
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
      phoneAuthorized,
      phoneMasked,
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

  async confirmBook() {
    const tutor = this.data.bookingTutor;
    const parent = this._parent || Storage.getCurrentParent();
    const hours = Number(this.data.hours) || 2;
    const amount = Number(this.data.escrowAmount) || tutor.hourlyRate * hours;
    const space = this.data.spaces[this.data.spaceIndex];
    const slot = this.data.selectedSlot;

    // Save contract locally
    Storage.saveContract({
      parentId: parent.id,
      mentorId: tutor.mentorId,
      amount,
      hours,
      space,
      schedule: slot,
      rule: '课后48小时无异议自动解冻划拨（导师92%/平台8%）'
    });

    // Create booking locally first
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

    // Send booking to server API (triggers SMS notification)
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';

      await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/bookings`,
          method: 'POST',
          data: {
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
          },
          success: resolve,
          fail: reject
        });
      });
      
      console.log('[Booking Created on Server] SMS notification sent');
    } catch (error) {
      console.error('[Server Booking Error]', error);
      // Don't fail the booking if server call fails
    }

    // WeChat payment flow (non-zero amount)
    if (amount > 0 && booking && booking.id) {
      this.handleWeChatPayment(booking.id, amount, tutor.maskedName, (tutor.subjects && tutor.subjects[0]) || '辅导');
    } else {
      showToast('约课成功 · 托管已锁定，可关联 IoT 履约面板');
    }

    this.reload();
    // Reset IoT state for demo
    this.setIoTState('idle');
  },

  async handleWeChatPayment(bookingId, amount, tutorName, subject) {
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
      const payMode = config.PAY_MODE || 'demo';

      // 创建预支付订单
      const prepayRes = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/pay/wechat/prepay`,
          method: 'POST',
          data: {
            bookingId: bookingId,
            amount: Math.round(amount * 100), // 转换为分
            description: `星火学伴 · ${subject} · ${tutorName}`
          },
          success: resolve,
          fail: reject
        });
      });

      const prepayResult = prepayRes.data;

      if (prepayRes.statusCode !== 200 || !prepayResult.prepayId) {
        showToast('支付订单创建失败', 'error');
        console.error('Prepay failed:', prepayResult);
        return;
      }

      // Demo 模式：自动模拟支付成功
      if (payMode === 'demo' && prepayResult.mock) {
        showToast('支付订单创建成功（演示模式）');

        setTimeout(async () => {
          try {
            const confirmRes = await new Promise((resolve, reject) => {
              wx.request({
                url: `${apiBase}/api/pay/wechat/mock-confirm`,
                method: 'POST',
                data: { outTradeNo: prepayResult.outTradeNo },
                success: resolve,
                fail: reject
              });
            });

            const confirmResult = confirmRes.data;

            if (confirmRes.statusCode === 200 && confirmResult.success) {
              showToast('✓ 支付成功（演示模拟）');
              this.reload();
            } else {
              showToast('模拟支付确认失败', 'error');
            }
          } catch (error) {
            console.error('Mock confirm error:', error);
            showToast('模拟支付处理异常', 'warning');
          }
        }, 1500);
      } else {
        // 生产模式：调用微信支付
        const payParams = {
          timeStamp: String(Math.floor(Date.now() / 1000)),
          nonceStr: prepayResult.prepayId,
          package: `prepay_id=${prepayResult.prepayId}`,
          signType: 'RSA',
          paySign: prepayResult.paySign || 'PLACEHOLDER'
        };

        wx.requestPayment({
          ...payParams,
          success: () => {
            showToast('✓ 支付成功');
            this.reload();
          },
          fail: (err) => {
            if (err.errMsg.includes('cancel')) {
              showToast('支付已取消', 'warning');
            } else {
              showToast('支付失败，请重试', 'error');
            }
          }
        });
      }
    } catch (error) {
      console.error('WeChat payment error:', error);
      showToast('支付处理异常，请稍后重试', 'error');
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
        const config = require('../../utils/config');
        const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
        const session = Storage.getSession() || {};
        
        wx.request({
          url: `${apiBase}/api/auth/phone/audit`,
          method: 'POST',
          data: {
            userId: session.userId || this.data.parentId || 'anonymous',
            action: 'authorize_deny',
            source: 'wechat_auth_booking',
            success: false
          }
        });
      } catch (error) {
        console.error('[Audit Log Error]', error);
      }
      
      return;
    }

    const code = e.detail.code;
    
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
      const session = Storage.getSession() || {};

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/wx/phone`,
          method: 'POST',
          data: { code, userId: session.userId || this.data.parentId || '' },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        // Update parent profile with phone
        const parent = this._parent || Storage.getCurrentParent();
        if (parent) {
          parent.phone = result.phone;
          Storage.saveParent(parent);
        }
        
        this.setData({
          phoneAuthorized: true,
          phoneMasked: result.masked,
          phoneAuthShow: false,
          parentPhone: result.phone
        });
        
        showToast('手机号授权成功');
        
        // Bind phone to account
        await this.bindPhoneToAccount(result.phone, 'wechat_auth_booking');
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
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/auth/sms/send`,
          method: 'POST',
          data: { phone, scene: 'bind' },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        const msg = result.provider === 'mock'
          ? '验证码已发送（演示可用：888888）'
          : '验证码已发送，请查收';
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
      showToast('发送失败（演示可用：888888）', 'warning');
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
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/auth/sms/verify`,
          method: 'POST',
          data: { phone, code, scene: 'bind' },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        const masked = phone.slice(0, 3) + '****' + phone.slice(7);
        
        // Update parent profile with phone
        const parent = this._parent || Storage.getCurrentParent();
        if (parent) {
          parent.phone = result.phone;
          Storage.saveParent(parent);
        }
        
        this.setData({
          phoneAuthorized: true,
          phoneMasked: masked,
          phoneAuthShow: false,
          showSmsBinding: false,
          smsPhone: '',
          smsCode: '',
          parentPhone: result.phone
        });

        showToast('手机号验证成功');
        await this.bindPhoneToAccount(result.phone, 'sms_verify_booking');
      } else {
        showToast(result.error || '验证失败', 'error');
      }
    } catch (error) {
      console.error('[SMS Verify Error]', error);
      
      // Fallback for demo mode
      if (code === '888888') {
        const masked = phone.slice(0, 3) + '****' + phone.slice(7);
        
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
        showToast('手机号验证成功（演示模式）');
        await this.bindPhoneToAccount(phone, 'sms_verify_booking');
      } else {
        showToast('验证失败（演示可用：888888）', 'warning');
      }
    }
  },

  async bindPhoneToAccount(phone, source) {
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
      const session = Storage.getSession() || {};
      const userId = session.userId || this.data.parentId || 'TEMP-' + Date.now();

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/auth/phone/bind`,
          method: 'POST',
          data: { userId, phone, source },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        console.log('[Phone Bind Success]', result);
        Storage.setSession(Object.assign({}, session, { userId, phone }));
      } else {
        console.error('[Phone Bind Failed]', result.error);
      }
    } catch (error) {
      console.error('[Phone Bind Error]', error);
    }
  }
});
