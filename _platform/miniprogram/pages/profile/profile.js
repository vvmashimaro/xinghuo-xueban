const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    parentName: '',
    studentNickname: '',
    phoneAuthorized: false,
    phoneMasked: '',
    phoneBoundAt: '',
    confirmUnbindShow: false,
    confirmCancelShow: false
  },

  onShow() {
    this.reload();
  },

  reload() {
    const parent = Storage.getCurrentParent();
    if (!parent) {
      showToast('请先登录', 'warning');
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    const phone = parent.phone || '';
    const phoneAuthorized = !!phone;
    const phoneMasked = phone ? (phone.slice(0, 3) + '****' + phone.slice(7)) : '';

    this.setData({
      parentName: parent.parentName || '家长',
      studentNickname: parent.studentNickname || '',
      phoneAuthorized,
      phoneMasked,
      phoneBoundAt: parent.phoneBoundAt || '',
      parentId: parent.id
    });

    this._parent = parent;
  },

  goPrivacyPage() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goEditProfile() {
    wx.navigateTo({ url: '/pages/parent-register/parent-register?mode=edit' });
  },

  showUnbindConfirm() {
    this.setData({ confirmUnbindShow: true });
  },

  hideUnbindConfirm() {
    this.setData({ confirmUnbindShow: false });
  },

  async onUnbindPhone() {
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
      const session = Storage.getSession() || {};
      const userId = session.userId || this.data.parentId || '';

      if (!userId) {
        showToast('用户信息不完整', 'error');
        return;
      }

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/auth/phone/unbind`,
          method: 'POST',
          data: { userId },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        // Update local storage
        const parent = this._parent || Storage.getCurrentParent();
        if (parent) {
          parent.phone = '';
          parent.phoneUnboundAt = new Date().toISOString();
          Storage.saveParent(parent);
        }

        this.setData({
          phoneAuthorized: false,
          phoneMasked: '',
          confirmUnbindShow: false
        });

        showToast('手机号已解绑');
      } else {
        showToast(result.error || '解绑失败', 'error');
      }
    } catch (error) {
      console.error('[Unbind Phone Error]', error);
      showToast('解绑失败，请稍后重试', 'error');
    }
  },

  showCancelConfirm() {
    this.setData({ confirmCancelShow: true });
  },

  hideCancelConfirm() {
    this.setData({ confirmCancelShow: false });
  },

  async onCancelAccount() {
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';
      const session = Storage.getSession() || {};
      const userId = session.userId || this.data.parentId || '';

      if (!userId) {
        showToast('用户信息不完整', 'error');
        return;
      }

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/auth/phone/cancel`,
          method: 'POST',
          data: { userId },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        showToast('账号已注销，正在退出...');
        
        // Clear all local data
        Storage.clearSession();
        
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/login/login' });
        }, 1500);
      } else {
        showToast(result.error || '注销失败', 'error');
      }
    } catch (error) {
      console.error('[Cancel Account Error]', error);
      showToast('注销失败，请稍后重试', 'error');
    }
  },

  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: '/pages/parent-dashboard/parent-dashboard' });
      }
    });
  }
});
