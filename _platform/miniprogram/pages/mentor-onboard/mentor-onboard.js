const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    step: 1,
    degrees: ['本科在读 (大一)', '本科在读 (大二)', '本科在读 (大三)', '本科在读 (大四)', '全日制本科毕业生', '硕士研究生在读', '硕士研究生', '博士研究生在读'],
    degreeIndex: 2,
    banks: ['招商银行', '工商银行', '建设银行', '农业银行', '中国银行', '交通银行'],
    bankIndex: 0,
    spaces: Storage.SPACE_OPTIONS || ['青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'],
    spaceIndex: 0,
    subjectChips: [],
    styleChips: [],
    subjectOptions: ['小学数学', '小学英语', '小学语文', '初中数学', '初中物理', '初中英语', '初中化学', '初中语文', '初中全科答疑', '高中数学', '高中物理', '高中英语', '高中化学', '高中语文', '考研数学(一/二/三)', '考研英语(一/二)', '美术艺考文化课冲刺'],
    styleOptions: ['引导启发解题', '大题压轴模型归纳', '思维导图教学', '基础漏洞重构', '错题本高效提分法', '耐心督学陪读', '考前心态疏导'],
    form: {
      realName: '', phone: '', idCard: '', university: '', degree: '本科在读 (大三)',
      chsiCode: '', bankName: '招商银行', bankCardNumber: '',
      nonPublic: false, privacy: false,
      subjects: [], scoreHighlight: '', hourlyRate: '130', styles: [],
      lectureUrl: '', spacePreference: '青羊金沙文化微网点'
    },
    l1Pct: 0,
    l1State: {},
    resCode: '', resName: '', resUniversity: '', resHourly: ''
  },

  async onLoad() {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    const session = Storage.getSession() || {};
    if (session.phone) {
      this.setData({ 'form.phone': session.phone });
    }
    this.refreshL1();
    this.refreshChips();
  },

  onField(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['form.' + k]: e.detail.value }, () => this.refreshL1());
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
    const i = Number(e.detail.value);
    this.setData({ spaceIndex: i, 'form.spacePreference': this.data.spaces[i] });
  },
  onToggleNonPublic() {
    this.setData({ 'form.nonPublic': !this.data.form.nonPublic }, () => this.refreshL1());
  },
  onTogglePrivacy() {
    this.setData({ 'form.privacy': !this.data.form.privacy }, () => this.refreshL1());
  },

  refreshL1() {
    const f = this.data.form;
    const state = {
      realName: !!((f.realName || '').trim()),
      phone: (f.phone || '').length === 11,
      idCard: (f.idCard || '').trim().length >= 15,
      university: !!((f.university || '').trim()),
      chsiCode: (f.chsiCode || '').trim().length >= 12,
      bankCard: (f.bankCardNumber || '').trim().length >= 16,
      nonPublic: !!f.nonPublic,
      privacy: !!f.privacy
    };
    const keys = Object.keys(state);
    const done = keys.filter((k) => state[k]).length;
    this.setData({ l1State: state, l1Pct: Math.round((done / keys.length) * 100) });
  },


  refreshChips() {
    const subjects = this.data.form.subjects || [];
    const styles = this.data.form.styles || [];
    this.setData({
      subjectChips: (this.data.subjectOptions || []).map((name) => ({ name, on: subjects.indexOf(name) >= 0 })),
      styleChips: (this.data.styleOptions || []).map((name) => ({ name, on: styles.indexOf(name) >= 0 }))
    });
  },

  toggleSubject(e) {
    const v = e.currentTarget.dataset.v;
    const list = (this.data.form.subjects || []).slice();
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1); else list.push(v);
    this.setData({ 'form.subjects': list }, () => this.refreshChips());
  },
  toggleStyle(e) {
    const v = e.currentTarget.dataset.v;
    const list = (this.data.form.styles || []).slice();
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1); else list.push(v);
    this.setData({ 'form.styles': list }, () => this.refreshChips());
  },

  goL2() {
    this.refreshL1();
    const s = this.data.l1State;
    if (!s.realName || !s.phone || !s.idCard) {
      showToast('请完整填写姓名、手机号码及身份证号！', 'error');
      return;
    }
    if (!s.university) { showToast('请填写就读/毕业高校！', 'error'); return; }
    if (!s.chsiCode) { showToast('请输入有效的学信网在线验证码（通常为16位）！', 'error'); return; }
    if (!s.bankCard) { showToast('请填写 16-19 位银联借记卡号！', 'warning'); return; }
    if (!s.nonPublic) { showToast('请勾选“公立学校在职教师禁入承诺”！', 'warning'); return; }
    if (!s.privacy) { showToast('请勾选《个人信息保护与法定核查授权条款》！', 'warning'); return; }
    this.setData({ step: 2 });
    showToast('L1 身份、学信网与清算账户签约通过！');
  },

  backL1() { this.setData({ step: 1 }); },

  submitApp() {
    const f = this.data.form;
    if (!f.subjects.length) {
      showToast('请至少选择一门擅长主讲的学科！', 'warning');
      return;
    }
    if (!f.hourlyRate || Number(f.hourlyRate) <= 0) {
      showToast('请设定合理的期望时薪！', 'warning');
      return;
    }
    if (!(f.lectureUrl || '').trim()) {
      showToast('请提供试讲视频或板书讲义网盘提取链接！', 'warning');
      return;
    }
    const saved = Storage.addMentor({
      realName: f.realName.trim(),
      phone: f.phone.trim(),
      idCard: f.idCard.trim(),
      university: f.university.trim(),
      province: '四川',
      degree: f.degree,
      chsiCode: f.chsiCode.trim(),
      chsiStatus: '有效 (在籍)',
      chsiMajor: f.university.trim() + ' · 在籍核验',
      publicTeacherCompliance: true,
      subjects: f.subjects.slice(),
      customSubjects: [],
      hourlyRate: parseInt(f.hourlyRate, 10) || 0,
      rateDifficulty: '待评估',
      rateTierNote: '',
      scoreHighlight: (f.scoreHighlight || '').trim(),
      styles: f.styles.length ? f.styles.slice() : ['引导启发解题'],
      proofFiles: [],
      lectureUrl: f.lectureUrl.trim(),
      bankName: f.bankName,
      bankCardNumber: f.bankCardNumber.trim(),
      status: 'pending',
      evalGrade: '待教研评级',
      reviewComment: '',
      spacePreference: f.spacePreference
    });
    this.setData({
      step: 3,
      resCode: saved.code,
      resName: saved.realName,
      resUniversity: saved.university,
      resHourly: '¥ ' + saved.hourlyRate + ' /h'
    });
    showToast('入库申请已提交！可进入导师工作台查看待审状态');
  },

  goDashboard() {
    wx.reLaunch({ url: '/pages/mentor-dashboard/mentor-dashboard' });
  },
  goLogin() {
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
