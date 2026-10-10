const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');
const { UNIVERSITY_OPTIONS, CHSI_ARCHIVE_URL } = require('../../utils/universities');

const DEGREES = [
  '本科在读 (大一)', '本科在读 (大二)', '本科在读 (大三)', '本科在读 (大四)',
  '全日制本科毕业生', '硕士研究生在读', '硕士研究生', '博士研究生在读'
];
const BANKS = ['招商银行', '工商银行', '建设银行', '农业银行', '中国银行', '交通银行'];

Page({
  data: {
    step: 1,
    universities: UNIVERSITY_OPTIONS,
    universityIndex: 0,
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
    chsiUrl: CHSI_ARCHIVE_URL,
    form: {
      realName: '',
      phone: '',
      idCard: '',
      university: UNIVERSITY_OPTIONS[0],
      degree: DEGREES[2],
      chsiCode: '',
      bankName: BANKS[0],
      bankCard: '',
      privacy: false,
      subjects: [],
      scoreHighlight: '',
      hourlyRate: '120',
      lectureUrl: '',
      spaceIndex: 0
    },
    proofFiles: [],
    submitting: false
  },

  onLoad() {
    Storage.seedIfEmpty();
    const session = Storage.getSession() || {};
    if (session.phone) {
      this.setData({ 'form.phone': session.phone });
    }
    this.refreshSubjectChips();
  },

  onField(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value });
  },

  onUniversityManual(e) {
    const val = e.detail.value;
    this.setData({ universityManual: val, 'form.university': val.trim() });
  },

  onUniversityPick(e) {
    const i = Number(e.detail.value);
    const name = this.data.universities[i];
    const showManual = name === '其他';
    this.setData({
      universityIndex: i,
      showUniversityManual: showManual,
      universityManual: showManual ? this.data.universityManual : '',
      'form.university': showManual ? (this.data.universityManual || '').trim() : name
    });
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

  toggleSubject(e) {
    const v = e.currentTarget.dataset.v;
    const list = (this.data.form.subjects || []).slice();
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    else list.push(v);
    this.setData({ 'form.subjects': list }, () => this.refreshSubjectChips());
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
    return {
      realName: f.realName.trim(),
      phone: f.phone.trim(),
      idCard: f.idCard.trim(),
      university: this._resolvedUniversity(),
      province: '四川',
      degree: f.degree,
      chsiCode: (f.chsiCode || '').trim(),
      chsiStatus: f.chsiCode ? '待联网核验' : '未提供（选填）',
      subjects: (f.subjects || []).slice(),
      customSubjects: [],
      hourlyRate: parseInt(f.hourlyRate, 10) || 120,
      scoreHighlight: (f.scoreHighlight || '').trim(),
      styles: ['引导启发解题'],
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
      if (Storage.isLoggedIn()) {
        Storage.addMentor(payload);
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
          Storage.addMentor(payload);
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
