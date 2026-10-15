const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    studentNickname: '',
    studentGrade: '',
    cityDistrict: '',
    passportSpace: '',
    passportBudget: '',
    passportGoal: '',
    passportPlans: []
  },

  async onShow() {
    if (Storage.ready) await Storage.ready();
    const parent = Storage.getCurrentParent();
    if (!parent) {
      showToast('请先完成学情建档', 'warning');
      wx.redirectTo({ url: '/pages/parent-register/parent-register?mode=create' });
      return;
    }
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
      studentNickname: parent.studentNickname || '',
      studentGrade: parent.studentGrade || '',
      cityDistrict: parent.cityDistrict || '',
      passportSpace: parent.selectedSpace || '',
      passportBudget: '¥' + (parent.budgetMin || 80) + '–' + (parent.budgetMax || 180) + '/小时',
      passportGoal: parent.targetGoal || '',
      passportPlans
    });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/parent-register/parent-register?mode=edit' });
  }
});
