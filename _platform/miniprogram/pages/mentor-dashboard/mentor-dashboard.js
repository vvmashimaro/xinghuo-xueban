const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    ready: false,
    mentorName: '',
    university: '',
    hourlyRate: 0,
    statusLabel: '审核中',
    inbox: [],
    spaces: Storage.SPACE_OPTIONS,
    spaceIndex: 0
  },

  _mentor: null,

  async onShow() {
    if (!Storage.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    await Storage.hydrateFromServer();
    const mentor = Storage.getCurrentMentor();
    if (!mentor) {
      wx.reLaunch({ url: '/pages/mentor-onboard/mentor-onboard' });
      return;
    }
    this._mentor = mentor;
    const inbox = Storage.getBookingsForMentor(mentor.id)
      .filter((b) => b.status === 'pending_accept')
      .map((b) => Object.assign({}, b, {
        studentNickname: b.studentNickname || '学员'
      }));
    const statusLabel = mentor.status === 'approved' ? '已认证' : mentor.status === 'pending' ? '待审核' : mentor.status;
    let spaceIndex = this.data.spaces.indexOf(mentor.spacePreference);
    if (spaceIndex < 0) spaceIndex = 0;
    this.setData({
      ready: true,
      mentorName: mentor.realName || '导师',
      university: mentor.university || '',
      hourlyRate: mentor.hourlyRate || 0,
      statusLabel,
      inbox,
      spaceIndex
    });
  },

  async accept(e) {
    const id = e.currentTarget.dataset.id;
    await Storage.respondToBooking(id, { accept: true });
    showToast('已接单');
    this.onShow();
  },

  async decline(e) {
    const id = e.currentTarget.dataset.id;
    await Storage.respondToBooking(id, { decline: true, reason: '时间冲突' });
    showToast('已婉拒');
    this.onShow();
  },

  onSpace(e) {
    this.setData({ spaceIndex: Number(e.detail.value) });
  },

  async saveSpace() {
    const m = this._mentor;
    if (!m) return;
    const space = this.data.spaces[this.data.spaceIndex];
    await Storage.updateMentorProfile(m.id, { spacePreference: space, preferredSpaces: [space] });
    showToast('网点偏好已保存');
  },

  async logout() {
    await Storage.logout();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
