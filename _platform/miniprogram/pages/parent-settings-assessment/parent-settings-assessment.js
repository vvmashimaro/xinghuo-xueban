const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    assessmentSubject: '数学',
    assessmentSubjects: ['数学', '英语', '物理', '化学', '体育']
  },

  async onShow() {
    if (Storage.ready) await Storage.ready();
    const parent = Storage.getCurrentParent();
    if (!parent) {
      showToast('请先完成学情建档', 'warning');
      wx.redirectTo({ url: '/pages/parent-register/parent-register?mode=create' });
      return;
    }
    this._parent = parent;
    const subjects = (parent.subjects && parent.subjects.length)
      ? parent.subjects
      : this.data.assessmentSubjects;
    this.setData({
      assessmentSubjects: subjects,
      assessmentSubject: subjects[0] || '数学'
    });
  },

  onAssessmentSubject(e) {
    this.setData({ assessmentSubject: e.currentTarget.dataset.v || '数学' });
  },

  async submitQuickAssessment() {
    const parent = this._parent || Storage.getCurrentParent();
    if (!parent) return;
    const subject = this.data.assessmentSubject || '数学';
    await Storage.saveAssessment({
      parentId: parent.id,
      studentNickname: parent.studentNickname,
      studentGrade: parent.studentGrade,
      subject,
      source: 'miniprogram_settings',
      selfReportLevel: '待完善',
      note: '小程序侧栏测评入口登记'
    });
    showToast('测评意向已登记，请按导师要求完成详细测评');
  }
});
