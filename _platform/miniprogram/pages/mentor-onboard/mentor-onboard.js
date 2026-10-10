const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    step: 1,
    spaces: Storage.SPACE_OPTIONS,
    subjectOptions: [
      '初中数学', '初中物理', '初中英语', '高中数学', '高中物理',
      '考研数学(一/二/三)', '考研英语(一/二)', '体育专项训练与中考体考'
    ],
    form: {
      realName: '',
      phone: '',
      idCard: '',
      university: '',
      chsiCode: '',
      bankCard: '',
      privacy: false,
      subjectsMap: {},
      hourlyRate: '120',
      lectureUrl: '',
      spaceIndex: 0
    }
  },

  onLoad() {
    Storage.seedIfEmpty();
    const session = Storage.getSession() || {};
    if (session.phone) {
      this.setData({ 'form.phone': session.phone });
    }
  },

  onField(e) {
    const k = e.currentTarget.dataset.k;
    const form = Object.assign({}, this.data.form, { [k]: e.detail.value });
    this.setData({ form });
  },

  togglePrivacy() {
    const form = Object.assign({}, this.data.form, { privacy: !this.data.form.privacy });
    this.setData({ form });
  },

  goL2() {
    const f = this.data.form;
    if (!f.realName || !f.phone || !f.idCard || !f.university || !f.chsiCode || !f.bankCard) {
      showToast('请完整填写 L1 信息', 'warning');
      return;
    }
    if (!f.privacy) {
      showToast('请勾选授权条款', 'warning');
      return;
    }
    this.setData({ step: 2 });
  },

  backL1() { this.setData({ step: 1 }); },

  toggleSubject(e) {
    const s = e.currentTarget.dataset.s;
    const map = Object.assign({}, this.data.form.subjectsMap);
    map[s] = !map[s];
    this.setData({ 'form.subjectsMap': map });
  },

  onSpace(e) {
    const form = Object.assign({}, this.data.form, { spaceIndex: Number(e.detail.value) });
    this.setData({ form });
  },

  submit() {
    const f = this.data.form;
    const subjects = Object.keys(f.subjectsMap).filter((k) => f.subjectsMap[k]);
    if (!subjects.length) {
      showToast('请选择擅长学科', 'warning');
      return;
    }
    if (!f.lectureUrl) {
      showToast('请填写试讲链接', 'warning');
      return;
    }
    Storage.addMentor({
      realName: f.realName.trim(),
      phone: f.phone.trim(),
      idCard: f.idCard.trim(),
      university: f.university.trim(),
      degree: '本科/硕士在籍',
      chsiCode: f.chsiCode.trim(),
      bankCardNumber: f.bankCard.trim(),
      subjects,
      hourlyRate: parseInt(f.hourlyRate, 10) || 120,
      lectureUrl: f.lectureUrl.trim(),
      spacePreference: this.data.spaces[f.spaceIndex],
      styles: ['引导启发解题'],
      status: 'pending'
    });
    showToast('已提交，进入工作台查看审核状态');
    wx.reLaunch({ url: '/pages/mentor-dashboard/mentor-dashboard' });
  }
});
