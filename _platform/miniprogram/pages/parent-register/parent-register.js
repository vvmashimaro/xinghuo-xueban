const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');
const { getSyllabusCategory, getTopicsForSubject, PACING_OPTIONS } = require('../../utils/syllabus');

const DEFAULT_TILES = [
  { name: '数学', hint: '几何/函数' },
  { name: '物理', hint: '力学/电学' },
  { name: '英语', hint: '阅读/写作' },
  { name: '化学', hint: '实验/推断' },
  { name: '语文', hint: '阅读/作文' },
  { name: '体育', hint: '体考/专项' },
  { name: '政治', hint: '考研政治' },
  { name: '全科陪读答疑', hint: '作业答疑' }
];

Page({
  data: {
    editMode: false,
    pageTitle: '学情建档与注册',
    heroSub: '分科考纲 · 双柄预算 · 托管一课一消',
    submitLabel: '完成建档并进入匹配',
    phoneReadonly: false,
    editingId: '',
    parentName: '',
    phone: '',
    studentNickname: '',
    grades: [
      '初三 (中考冲刺)', '初二', '初一', '高三 (高考总复习)', '高二', '高一',
      '小六 (小升初)', '考研公共课冲刺 (英/数/政)', '考研专业课一对一备考',
      '艺体专项 · 中考体考/体育', '艺体专项 · 舞蹈/播音艺考', '高三艺考文化课冲刺'
    ],
    gradeIndex: 0,
    districts: ['青羊区', '武侯区', '高新区', '锦江区', '成华区', '金牛区'],
    districtIndex: 0,
    spaces: Storage.SPACE_OPTIONS,
    spaceIndex: 0,
    subjectGroups: [],
    selectedSubjects: [],
    subjectPlans: {},
    budgetMin: 80,
    budgetMax: 180,
    targetGoal: '',
    consent: false,
    wizardShow: false,
    wizardSubject: '',
    wizardTopics: []
  },

  async onLoad(options) {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    await Storage.fetchSubjectCatalog();
    const mode = (options.mode || '').toLowerCase();
    const session = Storage.getSession() || {};
    if (session.phone && mode === 'create') {
      this.setData({ phone: session.phone, phoneReadonly: !!Storage.isLoggedIn() });
    }
    if (mode === 'edit') {
      const parent = Storage.getCurrentParent();
      if (parent) this.fillParent(parent, true);
    } else if (mode !== 'create' && Storage.getCurrentParent()) {
      this.fillParent(Storage.getCurrentParent(), false);
    }
    this.refreshSubjectGroups();
  },

  fillParent(parent, edit) {
    const grades = this.data.grades;
    let gradeIndex = grades.indexOf(parent.studentGrade);
    if (gradeIndex < 0) gradeIndex = 0;
    const districts = this.data.districts;
    let districtIndex = districts.indexOf(parent.cityDistrict);
    if (districtIndex < 0) districtIndex = 0;
    const spaces = this.data.spaces;
    let spaceIndex = spaces.indexOf(parent.selectedSpace);
    if (spaceIndex < 0) spaceIndex = 0;
    this.setData({
      editMode: edit,
      pageTitle: edit ? '学员画像更改' : '学情建档与注册',
      submitLabel: edit ? '保存画像并返回主控' : '完成建档并进入匹配',
      phoneReadonly: edit,
      editingId: parent.id || '',
      parentName: parent.parentName || '',
      phone: parent.phone || '',
      studentNickname: parent.studentNickname || '',
      gradeIndex,
      districtIndex,
      spaceIndex,
      selectedSubjects: (parent.subjects || []).slice(),
      subjectPlans: parent.subjectPlans || {},
      budgetMin: Number(parent.budgetMin) || 80,
      budgetMax: Number(parent.budgetMax) || 180,
      targetGoal: parent.targetGoal || '',
      consent: true
    });
  },

  refreshSubjectGroups() {
    const grade = this.data.grades[this.data.gradeIndex] || '';
    const category = getSyllabusCategory(grade);
    const selected = this.data.selectedSubjects || [];
    const tileNames = DEFAULT_TILES.map((t) => t.name);
    const withOn = (names) => names.map((name) => {
      const base = DEFAULT_TILES.find((t) => t.name === name) || { name, hint: '学科辅导' };
      return { name: base.name, hint: base.hint, on: selected.indexOf(base.name) >= 0 };
    });

    let groups = [];
    if (category === 'postgrad') {
      groups = [
        { title: '考研攻读', tiles: withOn(['数学', '英语', '政治']) },
        { title: '通用补强', tiles: withOn(['化学', '语文', '全科陪读答疑']) }
      ];
    } else if (category === 'artsports') {
      groups = [
        { title: '艺体特长', tiles: withOn(['体育', '语文', '英语']) },
        { title: '文化课', tiles: withOn(['数学', '全科陪读答疑']) }
      ];
    } else {
      groups = [{ title: '目标学科（可多选）', tiles: withOn(tileNames.filter((n) => n !== '政治')) }];
    }
    const wizardSubject = selected[0] || '';
    this.setData({ subjectGroups: groups, wizardSubject });
  },

  onParentName(e) { this.setData({ parentName: e.detail.value }); },
  onPhone(e) { this.setData({ phone: e.detail.value }); },
  onNickname(e) { this.setData({ studentNickname: e.detail.value }); },
  onGoal(e) { this.setData({ targetGoal: e.detail.value }); },
  onGrade(e) {
    this.setData({ gradeIndex: Number(e.detail.value) }, () => this.refreshSubjectGroups());
  },
  onDistrict(e) { this.setData({ districtIndex: Number(e.detail.value) }); },
  onSpace(e) { this.setData({ spaceIndex: Number(e.detail.value) }); },
  onBudgetMin(e) {
    let min = Number(e.detail.value);
    let max = this.data.budgetMax;
    if (min > max - 10) min = max - 10;
    this.setData({ budgetMin: min });
  },
  onBudgetMax(e) {
    let max = Number(e.detail.value);
    let min = this.data.budgetMin;
    if (max < min + 10) max = min + 10;
    this.setData({ budgetMax: max });
  },
  onToggleConsent() { this.setData({ consent: !this.data.consent }); },

  onToggleSubject(e) {
    const name = e.currentTarget.dataset.name;
    let selected = this.data.selectedSubjects.slice();
    const plans = Object.assign({}, this.data.subjectPlans);
    const idx = selected.indexOf(name);
    if (idx >= 0) {
      selected.splice(idx, 1);
      delete plans[name];
    } else {
      selected.push(name);
      if (!plans[name]) {
        plans[name] = { weakPoints: [], pacing: PACING_OPTIONS[0], pains: [] };
      }
    }
    this.setData({ selectedSubjects: selected, subjectPlans: plans, wizardSubject: selected[0] || '' }, () => this.refreshSubjectGroups());
  },

  openWizard() {
    const subject = this.data.wizardSubject;
    if (!subject) {
      showToast('请先选择学科', 'warning');
      return;
    }
    const grade = this.data.grades[this.data.gradeIndex];
    const topics = getTopicsForSubject(subject, grade).slice(0, 12);
    const plan = (this.data.subjectPlans[subject] || {}).weakPoints || [];
    this.setData({
      wizardShow: true,
      wizardTopics: topics.map((t) => ({ name: t, on: plan.indexOf(t) >= 0 }))
    });
  },

  closeWizard() { this.setData({ wizardShow: false }); },
  noop() {},
  onTopic(e) {
    const v = e.currentTarget.dataset.v;
    const wizardTopics = this.data.wizardTopics.map((t) =>
      t.name === v ? { name: t.name, on: !t.on } : t
    );
    this.setData({ wizardTopics });
  },

  saveWizard() {
    const subject = this.data.wizardSubject;
    const weakPoints = this.data.wizardTopics.filter((t) => t.on).map((t) => t.name);
    const plans = Object.assign({}, this.data.subjectPlans);
    plans[subject] = Object.assign({}, plans[subject] || {}, {
      weakPoints,
      pacing: (plans[subject] && plans[subject].pacing) || PACING_OPTIONS[0],
      pains: (plans[subject] && plans[subject].pains) || []
    });
    this.setData({ subjectPlans: plans, wizardShow: false });
    showToast('已保存「' + subject + '」学情计划');
  },

  buildPayload() {
    const plans = this.data.subjectPlans;
    const subjects = Object.keys(plans).length ? Object.keys(plans) : this.data.selectedSubjects;
    const syllabusTopics = [];
    subjects.forEach((s) => {
      (plans[s].weakPoints || []).forEach((t) => {
        if (syllabusTopics.indexOf(t) < 0) syllabusTopics.push(t);
      });
    });
    const budgetMin = this.data.budgetMin;
    const budgetMax = this.data.budgetMax;
    return {
      parentName: (this.data.parentName || '').trim(),
      parentRole: '家长',
      phone: (this.data.phone || '').trim(),
      studentNickname: (this.data.studentNickname || '').trim(),
      studentGrade: this.data.grades[this.data.gradeIndex],
      cityDistrict: this.data.districts[this.data.districtIndex],
      subjects,
      subjectPlans: plans,
      syllabusTopics,
      pacingMode: PACING_OPTIONS[0],
      budgetMin,
      budgetMax,
      budgetRate: Math.round((budgetMin + budgetMax) / 2),
      selectedSpace: this.data.spaces[this.data.spaceIndex],
      targetGoal: (this.data.targetGoal || '').trim(),
      painTags: []
    };
  },

  async onSubmit() {
    const payload = this.buildPayload();
    if (!payload.parentName || !payload.phone || !payload.studentNickname) {
      showToast('请填写家长、手机号与学员昵称', 'warning');
      return;
    }
    if (!payload.subjects.length) {
      showToast('请至少选择一门学科', 'warning');
      return;
    }
    if (!this.data.consent) {
      showToast('请勾选服务协议', 'warning');
      return;
    }
    if (this.data.editMode && this.data.editingId) {
      payload.id = this.data.editingId;
      Storage.saveParent(payload);
      showToast('画像已保存');
      wx.reLaunch({ url: '/pages/parent-dashboard/parent-dashboard' });
      return;
    }

    if (!Storage.isLoggedIn()) {
      await Storage.sendSMS(payload.phone, 'register');
      const verify = await Storage.verifySMS(payload.phone, '888888', 'register');
      if (!verify.success || !verify.ticket) {
        showToast(verify.error || '短信验证失败，请返回登录页获取验证码', 'warning');
        return;
      }
      const reg = await Storage.register(verify.ticket, 'parent', payload);
      if (reg.success) {
        wx.reLaunch({ url: '/pages/parent-dashboard/parent-dashboard' });
      } else {
        showToast(reg.error || '注册失败', 'error');
      }
      return;
    }

    Storage.saveParent(payload);
    await Storage.hydrateFromServer();
    wx.reLaunch({ url: '/pages/parent-dashboard/parent-dashboard' });
  },

  goLogin() {
    if (this.data.editMode) {
      wx.reLaunch({ url: '/pages/parent-dashboard/parent-dashboard' });
    } else {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  }
});
