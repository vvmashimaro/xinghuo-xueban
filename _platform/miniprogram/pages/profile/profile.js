const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    phoneMasked: '',
    roleLabel: '用户'
  },

  onShow() {
    if (!Storage.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const session = Storage.getSession() || {};
    const phone = session.phone || '';
    const masked = phone ? phone.slice(0, 3) + '****' + phone.slice(7) : '';
    const roleLabel = session.role === 'parent' ? '家长端' : session.role === 'mentor' ? '导师端' : '用户';
    this.setData({ phoneMasked: masked, roleLabel });
  },

  async unbind() {
    const result = await Storage.unbindPhone();
    if (result.success) {
      showToast('已解绑');
      this.onShow();
    } else {
      showToast(result.error || '解绑失败', 'error');
    }
  },

  async logout() {
    await Storage.logout();
    wx.reLaunch({ url: '/pages/login/login' });
  },

  async cancel() {
    const result = await Storage.cancelAccount('用户主动注销');
    if (result.success) {
      Storage.clearSession();
      showToast('账户已注销');
      wx.reLaunch({ url: '/pages/login/login' });
    } else {
      showToast(result.error || '注销失败', 'error');
    }
  }
});
