const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');
const {
  PROVINCES,
  schoolsForProvince,
  CHSI_ARCHIVE_URL
} = require('../../utils/universities');

const DEGREES = [
  '本科在读 (大一)', '本科在读 (大二)', '本科在读 (大三)', '本科在读 (大四)',
  '全日制本科毕业生', '硕士研究生在读', '硕士研究生', '博士研究生在读'
];
const BANKS = ['招商银行', '工商银行', '建设银行', '农业银行', '中国银行', '交通银行'];

const DEFAULT_STYLE_TAGS = [
  '引导启发解题',
  '大题压轴模型归纳',
  '基础漏洞重构',
  '耐心督学陪读',
  '错题本高效提分法',
  '考前心态疏导',
  '思维导图教学',
  '幽默风趣互动',
  '严格打卡督学',
  '竞赛培优拔高'
];

Page({
  data: {
    step: 1,
    provinces: PROVINCES,
    provinceIndex: 0,
    schools: schoolsForProvince(PROVINCES[0]),
    schoolIndex: 0,
    universityManual: '',
    showUniversityManual: false,
    degrees: DEGREES,
    degreeIndex: 2,
    banks: BANKS,
    bankIndex: 0,
    spaces: Storage.SPACE_OPTIONS,
    subjectOptions: [
      '小学数学', '小学英语', '小学语文', '初中数学', '初中物理', '初中英语',
      '初中化学', '初中语文', '高中数学', '高中物理', '高中英语', '高中化学',
      '考研数学(一/二/三)', '考研英语(一/二)', '体育专项训练与中考体考'
    ],
    subjectChips: [],
    styleChips: [],
    customStyleInput: '',
    chsiUrl: CHSI_ARCHIVE_URL,
    form: {
      realName: '',
      phone: '',
      idCard: '',
      province: PROVINCES[0],
      university: schoolsForProvince(PROVINCES[0])[0],
      degree: DEGREES[2],
      chsiCode: '',
      bankName: BANKS[0],
      bankCard: '',
      privacy: false,
      subjects: [],
      styles: ['引导启发解题'],
      scoreHighlight: '',
      hourlyRate: '120',
      lectureUrl: '',
      spaceIndex: 0
    },
    proofFiles: [],
    submitting: false
  },

  onLoad(options) {
    Storage.seedIfEmpty();
    const session = Storage.getSession() || {};
    const queryPhone = (options.phone || '').trim();
    const phone = queryPhone || (session.phone || '').trim();
    if (phone) {
      this.setData({ 'form.phone': phone });
    }
    this.refreshSubjectChips();
    this.refreshStyleChips();
  },

  onField(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value });
  },

  onProvincePick(e) {
    const i = Number(e.detail.value);
    const province = this.data.provinces[i];
    const schools = schoolsForProvince(province);
    const showManual = false;
    this.setData({
      provinceIndex: i,
      schools,
      schoolIndex: 0,
      showUniversityManual: showManual,
      universityManual: '',
      'form.province': province,
      'form.university': schools[0] || ''
    });
  },

  onSchoolPick(e) {
    const i = Number(e.detail.value);
    const name = this.data.schools[i];
    const showManual = name === '其他（手动输入）';
    this.setData({
      schoolIndex: i,
      showUniversityManual: showManual,
      universityManual: showManual ? this.data.universityManual : '',
      'form.university': showManual ? (this.data.universityManual || '').trim() : name
    });
  },

  onUniversityManual(e) {
    const val = e.detail.value;
    this.setData({ universityManual: val, 'form.university': val.trim() });
  },

  onDegree(e) {
    const i = Number(e.detail.value);
    this.setData({ degreeIndex: i, 'form.degree': this.data.degrees[i] });
  },

  onBank(e) {
    const i = Number(e.detail.value);
    this.setData({ bankIndex: i, 'form.bankName': this.data.banks[i] });
  },

  onSpace(e) {
    this.setData({ 'form.spaceIndex': Number(e.detail.value) });
  },

  togglePrivacy() {
    this.setData({ 'form.privacy': !this.data.form.privacy });
  },

  refreshSubjectChips() {
    const subjects = this.data.form.subjects || [];
    this.setData({
      subjectChips: (this.data.subjectOptions || []).map((name) => ({
        name,
        on: subjects.indexOf(name) >= 0
      }))
    });
  },

  refreshStyleChips() {
    const selected = this.data.form.styles || [];
    const preset = DEFAULT_STYLE_TAGS.map((name) => ({
      name,
      on: selected.indexOf(name) >= 0,
      custom: false
    }));
    const customOnly = selected
      .filter((s) => DEFAULT_STYLE_TAGS.indexOf(s) < 0)
      .map((name) => ({ name, on: true, custom: true }));
    this.setData({ styleChips: preset.concat(customOnly) });
  },

  toggleSubject(e) {
    const v = e.currentTarget.dataset.v;
    const list = (this.data.form.subjects || []).slice();
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    else list.push(v);
    this.setData({ 'form.subjects': list }, () => this.refreshSubjectChips());
  },

  toggleStyle(e) {
    const v = e.currentTarget.dataset.v;
    const list = (this.data.form.styles || []).slice();
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    else list.push(v);
    this.setData({ 'form.styles': list }, () => this.refreshStyleChips());
  },

  onCustomStyleInput(e) {
    this.setData({ customStyleInput: e.detail.value });
  },

  addCustomStyle() {
    const label = (this.data.customStyleInput || '').trim();
    if (!label) {
      showToast('请输入教学风格标签', 'warning');
      return;
    }
    const list = (this.data.form.styles || []).slice();
    if (list.indexOf(label) < 0) list.push(label);
    this.setData({ customStyleInput: '', 'form.styles': list }, () => this.refreshStyleChips());
  },

  openChsiQuery() {
    wx.setClipboardData({
      data: CHSI_ARCHIVE_URL,
      success() {
        showToast('学信网链接已复制，请在浏览器打开查询验证码');
      }
    });
  },

  chooseProof() {
    const remain = 6 - (this.data.proofFiles || []).length;
    if (remain <= 0) {
      showToast('最多上传 6 张证明图片', 'warning');
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const added = (res.tempFiles || []).map((f, idx) => ({
          path: f.tempFilePath,
          name: '就读证明' + (this.data.proofFiles.length + idx + 1),
          size: f.size ? Math.round(f.size / 1024) + 'KB' : '',
          local: true
        }));
        this.setData({ proofFiles: (this.data.proofFiles || []).concat(added) });
      }
    });
  },

  removeProof(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const list = (this.data.proofFiles || []).slice();
    list.splice(idx, 1);
    this.setData({ proofFiles: list });
  },

  _resolvedUniversity() {
    const f = this.data.form;
    if (this.data.showUniversityManual) {
      return (this.data.universityManual || f.university || '').trim();
    }
    return (f.university || '').trim();
  },

  goL2() {
    const f = this.data.form;
    const university = this._resolvedUniversity();
    if (!(f.realName || '').trim()) {
      showToast('请填写真实姓名', 'warning');
      return;
    }
    if (!/^1\d{10}$/.test((f.phone || '').trim())) {
      showToast('请填写 11 位手机号', 'warning');
      return;
    }
    if ((f.idCard || '').trim().length < 15) {
      showToast('请填写有效身份证号', 'warning');
      return;
    }
    if (!university) {
      showToast('请选择或填写就读/毕业高校', 'warning');
      return;
    }
    if ((f.bankCard || '').trim().length < 16) {
      showToast('请填写 16–19 位银联借记卡号', 'warning');
      return;
    }
    if (!f.privacy) {
      showToast('请勾选授权条款', 'warning');
      return;
    }
    this.setData({ step: 2, 'form.university': university });
  },

  backL1() {
    this.setData({ step: 1 });
  },

  _buildMentorPayload() {
    const f = this.data.form;
    const proofFiles = (this.data.proofFiles || []).map((p) => ({
      name: p.name || '证明图片',
      size: p.size || '',
      verified: false,
      url: p.path || p.url || ''
    }));
    const styles = (f.styles && f.styles.length) ? f.styles.slice() : ['引导启发解题'];
    return {
      realName: f.realName.trim(),
      phone: f.phone.trim(),
      idCard: f.idCard.trim(),
      university: this._resolvedUniversity(),
      province: f.province || this.data.provinces[this.data.provinceIndex] || '四川',
      degree: f.degree,
      chsiCode: (f.chsiCode || '').trim(),
      chsiStatus: f.chsiCode ? '待联网核验' : '未提供（选填）',
      subjects: (f.subjects || []).slice(),
      customSubjects: [],
      hourlyRate: parseInt(f.hourlyRate, 10) || 120,
      scoreHighlight: (f.scoreHighlight || '').trim(),
      styles,
      proofFiles,
      lectureUrl: (f.lectureUrl || '').trim(),
      bankName: f.bankName,
      bankCardNumber: f.bankCard.trim(),
      status: 'pending',
      spacePreference: this.data.spaces[f.spaceIndex] || this.data.spaces[0]
    };
  },

  async submit() {
    const f = this.data.form;
    if (!(f.subjects && f.subjects.length)) {
      showToast('请至少选择一门擅长学科', 'warning');
      return;
    }
    if (!f.lectureUrl || !f.lectureUrl.trim()) {
      showToast('请填写试讲链接', 'warning');
      return;
    }

    const payload = this._buildMentorPayload();
    this.setData({ submitting: true });

    try {
      const existing = Storage.getMentorByPhone(payload.phone);
      if (Storage.isLoggedIn() || existing) {
        if (existing && existing.id) {
          await Storage.updateMentorProfile(existing.id, payload);
        } else {
          Storage.addMentor(payload);
        }
        showToast('已提交，进入工作台查看审核状态');
        wx.reLaunch({ url: '/pages/mentor-dashboard/mentor-dashboard' });
        return;
      }

      await Storage.sendSMS(payload.phone, 'register');
      const verify = await Storage.verifySMS(payload.phone, '888888', 'register');
      if (!verify.success || !verify.ticket) {
        showToast(verify.error || '手机号验证失败，请先在登录页完成短信验证', 'warning');
        return;
      }
      const reg = await Storage.register(verify.ticket, 'mentor', payload);
      if (!reg.success) {
        if (reg.error && reg.error.indexOf('已注册') >= 0) {
          const mentor = Storage.getMentorByPhone(payload.phone);
          if (mentor && mentor.id) {
            await Storage.updateMentorProfile(mentor.id, payload);
          } else {
            Storage.addMentor(payload);
          }
          showToast('已提交建档申请');
          wx.reLaunch({ url: '/pages/mentor-dashboard/mentor-dashboard' });
          return;
        }
        showToast(reg.error || '提交失败', 'error');
        return;
      }
      showToast('已提交，进入工作台查看审核状态');
      wx.reLaunch({ url: '/pages/mentor-dashboard/mentor-dashboard' });
    } catch (err) {
      showToast((err && err.message) || '提交失败', 'error');
    } finally {
      this.setData({ submitting: false });
    }
  }
});
