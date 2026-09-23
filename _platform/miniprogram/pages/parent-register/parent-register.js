const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');
const {
  getTopicsForSubject,
  PAIN_OPTIONS,
  PACING_OPTIONS,
  AGREEMENT_TEXT
} = require('../../utils/syllabus');

const BUDGET_GAP = 10;

Page({
  data: {
    editMode: false,
    pageTitle: '学情建档与注册',
    heroTitle: '学员学情建档',
    heroSub: '分科配置考点 · 双柄预算 · 一课一消·托管划拨',
    submitLabel: '完成建档并进入匹配',
    phoneReadonly: false,
    editingId: '',
    parentName: '',
    phone: '',
    studentNickname: '',
    grades: ['小学五年级', '小学六年级', '初一', '初二', '初三 (中考冲刺)', '高一', '高二', '高三 (高考冲刺)', '艺考文化课冲刺'],
    gradeIndex: 4,
    districts: ['青羊区', '武侯区', '高新区', '锦江区', '成华区', '金牛区'],
    districtIndex: 0,
    spaces: Storage.SPACE_OPTIONS || ['青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'],
    spaceIndex: 0,
    subjectOptions: ['数学', '物理', '英语', '化学', '语文', '全科陪读答疑'],
    subjectOptionChips: [],
    selectedSubjects: [],
    subjectPlans: {},
    planChips: [],
    planCount: 0,
    topicCount: 0,
    budgetMin: 80,
    budgetMax: 180,
    targetGoal: '',
    consent: false,
    privacyRead: false,
    phoneAuthorized: false,
    phoneMasked: '',
    showSmsBinding: false,
    smsPhone: '',
    smsCode: '',
    smsCooldown: 0,
    wizardShow: false,
    wizardSubject: '',
    wizardStep: 1,
    wizardTopics: [],
    wizardPains: [],
    wizardPacing: PACING_OPTIONS[0],
    pacingOptions: PACING_OPTIONS,
    agreementShow: false,
    agreementSections: AGREEMENT_TEXT
  },

  async onLoad(options) {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    const opts = options || {};
    const session = Storage.getSession() || {};
    const modeHint = (opts.mode || '').toLowerCase();

    let parent = null;
    if (modeHint === 'edit') {
      parent = Storage.getCurrentParent();
    } else if (modeHint !== 'create' && session.phone) {
      const byPhone = Storage.getParents().find((p) => p.phone === session.phone);
      if (byPhone) parent = Storage.normalizeParentProfile(byPhone);
    }

    const editMode = modeHint === 'edit' || (!!parent && modeHint !== 'create');

    if (editMode && parent) {
      this.applyEditMode(parent);
    } else {
      // 创建模式：consent 默认未勾选；可带入会话手机号
      if (session.phone) {
        // 已登录用户：自动标记手机号已授权
        const masked = session.phone.slice(0, 3) + '****' + session.phone.slice(7);
        this.setData({ 
          phone: session.phone,
          phoneMasked: masked,
          phoneAuthorized: true,
          privacyRead: true
        });
      }
      this.setData({
        editMode: false,
        pageTitle: '学情建档与注册',
        heroTitle: '学员学情建档',
        heroSub: '分科配置考点 · 双柄预算 · 一课一消·托管划拨',
        submitLabel: '完成建档并进入匹配',
        phoneReadonly: false,
        consent: false
      });
      wx.setNavigationBarTitle({ title: '学情建档与注册' });
      this.refreshSubjectOptionChips();
    }
  },

  onUnload() {
    if (this._smsTimer) clearInterval(this._smsTimer);
  },

  applyEditMode(parent) {
    const grades = this.data.grades;
    const districts = this.data.districts;
    const spaces = this.data.spaces;
    let gradeIndex = grades.indexOf(parent.studentGrade);
    if (gradeIndex < 0) gradeIndex = 4;
    let districtIndex = districts.indexOf(parent.cityDistrict);
    if (districtIndex < 0) districtIndex = 0;
    let spaceIndex = spaces.indexOf(parent.selectedSpace);
    if (spaceIndex < 0) spaceIndex = 0;

    const plans = Object.assign({}, parent.subjectPlans || {});
    const selectedSubjects = (parent.subjects && parent.subjects.length)
      ? parent.subjects.slice()
      : Object.keys(plans);

    this.setData({
      editMode: true,
      pageTitle: '学员画像更改',
      heroTitle: '学员画像更改',
      heroSub: '更新学情与考纲 · 保存后返回家长主控',
      submitLabel: '保存画像并返回主控',
      phoneReadonly: true,
      editingId: parent.id || '',
      parentName: parent.parentName || '',
      phone: parent.phone || '',
      studentNickname: parent.studentNickname || '',
      gradeIndex,
      districtIndex,
      spaceIndex,
      selectedSubjects,
      subjectPlans: plans,
      budgetMin: Number(parent.budgetMin) || 80,
      budgetMax: Number(parent.budgetMax) || 180,
      targetGoal: parent.targetGoal || '',
      consent: true
    }, () => {
      this.refreshChips();
      this.refreshSubjectOptionChips();
    });
    wx.setNavigationBarTitle({ title: '学员画像更改' });
  },

  refreshSubjectOptionChips() {
    const selected = this.data.selectedSubjects || [];
    this.setData({
      subjectOptionChips: (this.data.subjectOptions || []).map((name) => ({
        name,
        on: selected.indexOf(name) >= 0
      }))
    });
  },

  onParentName(e) { this.setData({ parentName: e.detail.value }); },
  onPhone(e) {
    if (this.data.phoneReadonly) return;
    this.setData({ phone: e.detail.value });
  },
  onNickname(e) { this.setData({ studentNickname: e.detail.value }); },

  /* ========== 隐私政策与手机号授权 ========== */
  onTogglePrivacyRead() {
    this.setData({ privacyRead: !this.data.privacyRead });
  },

  goPrivacyPage(e) {
    e.stopPropagation();
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  async onWechatPhoneAuth(e) {
    console.log('[WeChat Phone Auth]', e);
    
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      // 用户拒绝授权
      showToast('已取消授权', 'warning');
      
      // 记录拒绝授权的审计日志
      try {
        const config = require('../../utils/config');
        const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
        const session = Storage.getSession() || {};
        
        wx.request({
          url: `${apiBase}/api/auth/phone/audit`,
          method: 'POST',
          data: {
            userId: session.userId || 'anonymous',
            action: 'authorize_deny',
            source: 'wechat_auth',
            success: false
          }
        });
      } catch (error) {
        console.error('[Audit Log Error]', error);
      }
      
      return;
    }

    // 获取手机号 code
    const code = e.detail.code;
    
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
      const session = Storage.getSession() || {};

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/wx/phone`,
          method: 'POST',
          data: { code, userId: session.userId || '' },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        this.setData({
          phone: result.phone,
          phoneMasked: result.masked,
          phoneAuthorized: true
        });
        
        showToast('手机号授权成功');
        
        // 绑定手机号到用户账号
        await this.bindPhoneToAccount(result.phone, 'wechat_auth');
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
        // 脱敏显示
        const masked = phone.slice(0, 3) + '****' + phone.slice(7);
        
        this.setData({
          phone: result.phone,
          phoneMasked: masked,
          phoneAuthorized: true,
          showSmsBinding: false,
          smsPhone: '',
          smsCode: ''
        });

        showToast('手机号验证成功');

        // 绑定手机号到用户账号
        await this.bindPhoneToAccount(result.phone, 'sms_verify');
      } else {
        showToast(result.error || '验证失败', 'error');
      }
    } catch (error) {
      console.error('[SMS Verify Error]', error);
      
      // 降级：演示模式验证
      if (code === '888888') {
        const masked = phone.slice(0, 3) + '****' + phone.slice(7);
        this.setData({
          phone: phone,
          phoneMasked: masked,
          phoneAuthorized: true,
          showSmsBinding: false,
          smsPhone: '',
          smsCode: ''
        });
        showToast('手机号验证成功（演示模式）');
        await this.bindPhoneToAccount(phone, 'sms_verify');
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

      // 如果没有 userId，生成一个临时 ID
      const userId = session.userId || 'TEMP-' + Date.now();

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
        
        // 更新 session
        Storage.setSession(Object.assign({}, session, { userId, phone }));
      } else {
        console.error('[Phone Bind Failed]', result.error);
        showToast(result.error || '绑定失败', 'error');
      }
    } catch (error) {
      console.error('[Phone Bind Error]', error);
    }
  },
  
  /* ========== 原有功能 ========== */
  onGoal(e) { this.setData({ targetGoal: e.detail.value }); },
  onGrade(e) { this.setData({ gradeIndex: Number(e.detail.value) }); },
  onDistrict(e) { this.setData({ districtIndex: Number(e.detail.value) }); },
  onSpace(e) { this.setData({ spaceIndex: Number(e.detail.value) }); },
  onToggleConsent() { this.setData({ consent: !this.data.consent }); },

  onBudgetMin(e) {
    let min = Number(e.detail.value);
    let max = this.data.budgetMax;
    if (min > max - BUDGET_GAP) min = max - BUDGET_GAP;
    if (min < 70) min = 70;
    this.setData({ budgetMin: min });
  },
  onBudgetMax(e) {
    let max = Number(e.detail.value);
    let min = this.data.budgetMin;
    if (max < min + BUDGET_GAP) max = min + BUDGET_GAP;
    if (max > 240) max = 240;
    this.setData({ budgetMax: max });
  },

  onSubjectTap(e) {
    const name = e.currentTarget.dataset.v;
    const selected = this.data.selectedSubjects.slice();
    const plans = Object.assign({}, this.data.subjectPlans);
    const idx = selected.indexOf(name);
    if (idx >= 0) {
      selected.splice(idx, 1);
      delete plans[name];
      showToast('已清除【' + name + '】的学情配置', 'warning');
      this.setData({ selectedSubjects: selected, subjectPlans: plans }, () => { this.refreshChips(); this.refreshSubjectOptionChips(); });
    } else {
      selected.push(name);
      this.setData({ selectedSubjects: selected }, () => { this.refreshSubjectOptionChips(); this.openWizardFor(name); });
    }
  },

  openWizard(e) {
    this.openWizardFor(e.currentTarget.dataset.v);
  },

  openWizardFor(subjectName) {
    const grade = this.data.grades[this.data.gradeIndex];
    const existing = this.data.subjectPlans[subjectName] || {
      weakPoints: [],
      pacing: PACING_OPTIONS[0],
      pains: []
    };
    const topics = getTopicsForSubject(subjectName, grade).map((name) => ({
      name,
      on: (existing.weakPoints || []).indexOf(name) >= 0
    }));
    const pains = PAIN_OPTIONS.map((name) => ({
      name,
      on: (existing.pains || []).indexOf(name) >= 0
    }));
    this.setData({
      wizardShow: true,
      wizardSubject: subjectName,
      wizardStep: 1,
      wizardTopics: topics,
      wizardPains: pains,
      wizardPacing: existing.pacing || PACING_OPTIONS[0]
    });
  },

  closeWizard() {
    const subj = this.data.wizardSubject;
    const plans = this.data.subjectPlans;
    if (subj && !plans[subj]) {
      const selected = this.data.selectedSubjects.filter((s) => s !== subj);
      this.setData({ selectedSubjects: selected }, () => this.refreshSubjectOptionChips());
    }
    this.setData({ wizardShow: false, wizardSubject: '' }, () => this.refreshChips());
  },

  toggleTopic(e) {
    const name = e.currentTarget.dataset.name;
    const list = this.data.wizardTopics.map((t) =>
      t.name === name ? { name: t.name, on: !t.on } : t
    );
    this.setData({ wizardTopics: list });
  },
  togglePain(e) {
    const name = e.currentTarget.dataset.name;
    const list = this.data.wizardPains.map((t) =>
      t.name === name ? { name: t.name, on: !t.on } : t
    );
    this.setData({ wizardPains: list });
  },
  onPacing(e) { this.setData({ wizardPacing: e.detail.value }); },
  wizPrev() { this.setData({ wizardStep: Math.max(1, this.data.wizardStep - 1) }); },
  wizNext() {
    if (this.data.wizardStep === 1) {
      const n = this.data.wizardTopics.filter((t) => t.on).length;
      if (n === 0) {
        showToast('请至少勾选一个薄弱考点', 'warning');
        return;
      }
    }
    this.setData({ wizardStep: Math.min(3, this.data.wizardStep + 1) });
  },
  wizSave() {
    const subj = this.data.wizardSubject;
    const weakPoints = this.data.wizardTopics.filter((t) => t.on).map((t) => t.name);
    const pains = this.data.wizardPains.filter((t) => t.on).map((t) => t.name);
    const plans = Object.assign({}, this.data.subjectPlans);
    plans[subj] = {
      weakPoints,
      pacing: this.data.wizardPacing,
      pains
    };
    const selected = this.data.selectedSubjects.slice();
    if (selected.indexOf(subj) < 0) selected.push(subj);
    this.setData({
      subjectPlans: plans,
      selectedSubjects: selected,
      wizardShow: false
    }, () => { this.refreshChips(); this.refreshSubjectOptionChips(); });
    showToast('【' + subj + '】学情配置已保存');
  },

  refreshChips() {
    const plans = this.data.subjectPlans;
    const subjects = Object.keys(plans);
    let topicCount = 0;
    const planChips = subjects.map((name) => {
      const plan = plans[name];
      const topicN = (plan.weakPoints || []).length;
      topicCount += topicN;
      return {
        name,
        topicN,
        painN: (plan.pains || []).length,
        pacingShort: (plan.pacing || '').split(' · ')[0] || '未设定位',
        preview: (plan.weakPoints || []).slice(0, 2).join('、') || '尚未勾选考点'
      };
    });
    this.setData({ planChips, planCount: subjects.length, topicCount });
  },

  openAgreement() { this.setData({ agreementShow: true }); },
  closeAgreement() { this.setData({ agreementShow: false }); },
  agreeFromModal() {
    this.setData({ agreementShow: false, consent: true });
    showToast('已勾选同意《资金托管与服务协议》');
  },

  submitProfile() {
    const parentName = (this.data.parentName || '').trim();
    const phone = (this.data.phone || '').trim();
    const studentNickname = (this.data.studentNickname || '').trim();
    if (!parentName || !phone || !studentNickname) {
      showToast('请填写家长称呼、手机号与学员昵称', 'warning');
      return;
    }
    
    // 非编辑模式需要验证手机号授权
    if (!this.data.editMode && !this.data.phoneAuthorized) {
      showToast('请先完成手机号授权', 'warning');
      return;
    }
    
    if (Object.keys(this.data.subjectPlans).length === 0) {
      showToast('请至少配置一门目标学科', 'warning');
      return;
    }
    if (!this.data.consent) {
      showToast('请阅读并勾选《资金托管与服务协议》', 'warning');
      return;
    }
    const plans = this.data.subjectPlans;
    const subjects = Object.keys(plans);
    const syllabusTopics = [];
    const painTags = [];
    let pacingMode = '';
    subjects.forEach((s) => {
      (plans[s].weakPoints || []).forEach((t) => {
        if (syllabusTopics.indexOf(t) < 0) syllabusTopics.push(t);
      });
      (plans[s].pains || []).forEach((p) => {
        if (painTags.indexOf(p) < 0) painTags.push(p);
      });
      if (!pacingMode && plans[s].pacing) pacingMode = plans[s].pacing;
    });
    const budgetMin = this.data.budgetMin;
    const budgetMax = this.data.budgetMax;
    const payload = {
      parentName,
      parentRole: '家长',
      phone,
      studentNickname,
      studentGrade: this.data.grades[this.data.gradeIndex],
      cityDistrict: this.data.districts[this.data.districtIndex],
      subjects,
      subjectPlans: plans,
      syllabusTopics,
      pacingMode: pacingMode || PACING_OPTIONS[0],
      budgetMin,
      budgetMax,
      budgetRate: Math.round((budgetMin + budgetMax) / 2),
      selectedSpace: this.data.spaces[this.data.spaceIndex],
      targetGoal: (this.data.targetGoal || '').trim(),
      painTags
    };
    if (this.data.editMode && this.data.editingId) {
      payload.id = this.data.editingId;
    }
    Storage.saveParent(payload);
    if (this.data.editMode) {
      showToast('画像已保存，正在返回主控…');
    } else {
      showToast('建档完成，正在进入智能匹配…');
    }
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/parent-dashboard/parent-dashboard' });
    }, 400);
  },

  goLogin() {
    if (this.data.editMode) {
      wx.navigateBack({
        fail: () => wx.reLaunch({ url: '/pages/parent-dashboard/parent-dashboard' })
      });
      return;
    }
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
