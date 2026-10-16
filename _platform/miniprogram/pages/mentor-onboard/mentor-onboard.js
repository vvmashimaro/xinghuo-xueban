const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');
const Chsi = require('../../utils/chsi-verify');
const ProofUpload = require('../../utils/proof-upload');
const SubjectCatalog = require('../../utils/subject-catalog');

Page({
  data: {
    step: 1,
    degrees: ['本科在读 (大一)', '本科在读 (大二)', '本科在读 (大三)', '本科在读 (大四)', '全日制本科毕业生', '硕士研究生在读', '硕士研究生', '博士研究生在读'],
    degreeIndex: 2,
    banks: ['招商银行', '工商银行', '建设银行', '农业银行', '中国银行', '交通银行'],
    bankIndex: 0,
    spaces: Storage.SPACE_OPTIONS || ['青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'],
    spaceIndex: 0,
    subjectGroupsView: [],
    selectedSubjectCount: 0,
    styleChips: [],
    styleOptions: ['引导启发解题', '大题压轴模型归纳', '思维导图教学', '基础漏洞重构', '错题本高效提分法', '耐心督学陪读', '考前心态疏导'],
    form: {
      realName: '', phone: '', idCard: '', university: '', degree: '本科在读 (大三)',
      chsiCode: '', bankName: '招商银行', bankCardNumber: '',
      privacy: false,
      subjects: [], scoreHighlight: '', hourlyRate: '130', styles: [],
      lectureUrl: '', spacePreference: '青羊金沙文化微网点'
    },
    l1Pct: 0,
    l1State: {},
    resCode: '', resName: '', resUniversity: '', resHourly: '',
    chsiBadgeText: '未验证',
    chsiBadgeClass: 'chsi-badge-idle',
    chsiVerifying: false,
    chsiVerifyBtnText: '联网验证',
    chsiPanelShow: false,
    chsiResult: null,
    proofFiles: []
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
  onChsiField(e) {
    this._chsiVerifiedResult = null;
    this.setData({
      'form.chsiCode': e.detail.value,
      chsiPanelShow: false,
      chsiBadgeText: Chsi.STATUS.idle.text,
      chsiBadgeClass: Chsi.STATUS.idle.cls,
      chsiVerifyBtnText: '联网验证'
    }, () => this.refreshL1());
  },
  openChsiArchive() {
    Chsi.openChsiArchive();
  },
  async triggerChsiVerify() {
    const f = this.data.form;
    if (this.data.chsiVerifying) return;
    try {
      this.setData({
        chsiVerifying: true,
        chsiVerifyBtnText: '核验中...',
        chsiBadgeText: Chsi.STATUS.verifying.text,
        chsiBadgeClass: Chsi.STATUS.verifying.cls
      });
      const result = await Chsi.runChsiVerification({
        realName: f.realName,
        chsiCode: f.chsiCode,
        university: f.university
      });
      this._chsiVerifiedResult = result;
      this.setData({
        chsiVerifying: false,
        chsiVerifyBtnText: '已验证',
        chsiBadgeText: Chsi.STATUS.ok.text,
        chsiBadgeClass: Chsi.STATUS.ok.cls,
        chsiPanelShow: true,
        chsiResult: result
      });
      showToast(`学信网核验成功：【${result.name} - ${result.university}】在籍有效！`);
    } catch (err) {
      this.setData({
        chsiVerifying: false,
        chsiVerifyBtnText: '联网验证',
        chsiBadgeText: Chsi.STATUS.idle.text,
        chsiBadgeClass: Chsi.STATUS.idle.cls
      });
      showToast((err && err.message) || '学信网验证失败', 'warning');
    }
  },
  chooseEduProofFiles() {
    this._pickAndUploadProofs('其它证明');
  },
  chooseProofFiles() {
    this._pickAndUploadProofs('新上传');
  },
  async _pickAndUploadProofs(tag) {
    try {
      wx.showLoading({ title: '上传中…', mask: true });
      const uploaded = await ProofUpload.pickProofFiles({ tag, count: 5 });
      wx.hideLoading();
      if (!uploaded.length) return;
      const added = uploaded.map((item) => ({
        id: item.id || Date.now() + Math.random(),
        name: item.name,
        size: item.size,
        tag: item.tag || tag,
        url: item.url,
        path: item.path
      }));
      this.setData({ proofFiles: (this.data.proofFiles || []).concat(added) });
      showToast(`已上传 ${added.length} 份${tag === '其它证明' ? '其它证明' : '佐证材料'}`);
    } catch (err) {
      wx.hideLoading();
      showToast((err && err.message) || '上传失败', 'warning');
    }
  },
  removeProof(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      proofFiles: (this.data.proofFiles || []).filter((x) => x.id !== id)
    });
    showToast('已移除该佐证材料', 'warning');
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
      bankCard: (f.bankCardNumber || '').trim().length >= 16,
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
      subjectGroupsView: SubjectCatalog.buildSubjectChipGroups(subjects),
      selectedSubjectCount: subjects.length,
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
    if (!s.bankCard) { showToast('请填写 16-19 位银联借记卡号！', 'warning'); return; }
    if (!s.privacy) { showToast('请勾选《个人信息保护与法定核查授权条款》！', 'warning'); return; }
    const f = this.data.form;
    const chsiTrim = (f.chsiCode || '').trim();
    if (chsiTrim.length >= 12 && !this._chsiVerifiedResult) {
      this._chsiVerifiedResult = Chsi.silentFallbackResult({
        realName: f.realName,
        chsiCode: chsiTrim,
        university: f.university
      });
    }
    this.setData({ step: 2 });
    showToast('L1 身份与清算账户签约通过！');
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
    const chsiTrim = (f.chsiCode || '').trim();
    const chsiMeta = chsiTrim.length >= 12
      ? (this._chsiVerifiedResult || Chsi.silentFallbackResult({
        realName: f.realName,
        chsiCode: chsiTrim,
        university: f.university
      }))
      : null;
    const proofFiles = (this.data.proofFiles || []).map((item) => ({
      id: item.id,
      name: item.name,
      size: item.size,
      tag: item.tag || '佐证材料',
      url: item.url,
      path: item.path
    }));
    const saved = Storage.addMentor({
      realName: f.realName.trim(),
      phone: f.phone.trim(),
      idCard: f.idCard.trim(),
      university: f.university.trim(),
      province: '四川',
      degree: f.degree,
      chsiCode: chsiTrim,
      chsiStatus: chsiMeta ? (chsiMeta.status || '有效 (在籍)') : '未填写',
      chsiMajor: chsiMeta && chsiMeta.university
        ? (chsiMeta.university + ' · 在籍核验')
        : (f.university.trim() + ' · 待学籍核验'),
      publicTeacherCompliance: true,
      subjects: f.subjects.slice(),
      customSubjects: [],
      hourlyRate: parseInt(f.hourlyRate, 10) || 0,
      rateDifficulty: '待评估',
      rateTierNote: '',
      scoreHighlight: (f.scoreHighlight || '').trim(),
      styles: f.styles.length ? f.styles.slice() : ['引导启发解题'],
      proofFiles: proofFiles,
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
    showToast('入库申请已提交！可在导师端查看待审状态');
  },

  goDashboard() {
    wx.reLaunch({ url: '/pages/mentor-dashboard/mentor-dashboard' });
  },
  goLogin() {
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
