const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');
const config = require('../../utils/config');

const ROLE_COPY = {
  mentor: {
    title: '青年导师端登录',
    subtitle: config.FEATURE_SMART_WAREHOUSE
      ? '银行合约秒结 · 智能教学仓接单'
      : '银行合约秒结 · 阳光透明接单授课'
  },
  parent: {
    title: '家长 / 学员登录',
    subtitle: '单次约课零预付 · 优选双一流学霸导师'
  }
};

Page({
  data: {
    role: 'parent',
    roleTitle: ROLE_COPY.parent.title,
    roleSubtitle: ROLE_COPY.parent.subtitle,
    mobile: '',
    smsCode: '',
    agreed: false,
    submitting: false,
    smsCooldown: 0
  },

  onLoad() {
    Storage.seedIfEmpty();
  },

  onUnload() {
    if (this._smsTimer) clearInterval(this._smsTimer);
  },

  onRole(e) {
    const role = e.currentTarget.dataset.role;
    const copy = ROLE_COPY[role];
    this.setData({
      role,
      roleTitle: copy.title,
      roleSubtitle: copy.subtitle,
      agreed: false
    });
  },

  onMobile(e) { this.setData({ mobile: e.detail.value }); },
  onSms(e) { this.setData({ smsCode: e.detail.value }); },
  onToggleAgree() { this.setData({ agreed: !this.data.agreed }); },
  onPrivacy(e) {
    e.stopPropagation();
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  _startCooldown() {
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
  },

  async onSendSms() {
    const mobile = (this.data.mobile || '').trim();
    if (!/^1\d{10}$/.test(mobile)) {
      showToast('请输入 11 位手机号', 'warning');
      return;
    }
    if (this.data.smsCooldown > 0) return;
    const result = await Storage.sendSMS(mobile, 'login');
    if (result.success) {
      showToast(result.provider === 'mock' ? '验证码已发送' : '验证码已发送');
      this._startCooldown();
    } else {
      showToast(result.error || '发送失败', 'error');
    }
  },

  async onSubmit() {
    const { role, mobile: rawMobile, smsCode, agreed } = this.data;
    const mobile = (rawMobile || '').trim();
    if (!/^1\d{10}$/.test(mobile)) {
      showToast('请输入有效手机号', 'warning');
      return;
    }
    if (!agreed) {
      showToast('请勾选协议', 'warning');
      return;
    }
    if (!/^\d{6}$/.test((smsCode || '').trim())) {
      showToast('请输入 6 位验证码', 'error');
      return;
    }

    this.setData({ submitting: true });
    try {
      const verify = await Storage.verifySMS(mobile, smsCode.trim(), 'login');
      if (!verify.success || !verify.ticket) {
        showToast(verify.error || '验证码错误', 'error');
        return;
      }
      const loginResult = await Storage.login(verify.ticket, role, mobile);
      if (!loginResult.success) {
        showToast(loginResult.error || '登录失败', 'error');
        return;
      }
      await Storage.hydrateFromServer();
      let url = '/pages/login/login';
      if (role === 'mentor') {
        const mentor = Storage.getCurrentMentor();
        url = mentor && mentor.status === 'approved'
          ? '/pages/mentor-dashboard/mentor-dashboard'
          : '/pages/mentor-onboard/mentor-onboard';
        showToast(mentor && mentor.status === 'approved' ? '欢迎回来' : '请完成导师建档');
      } else {
        const parent = Storage.getCurrentParent();
        url = parent
          ? '/pages/parent-dashboard/parent-dashboard'
          : '/pages/parent-register/parent-register?mode=create';
        showToast(parent ? '欢迎回来' : '请先完成学情建档');
      }
      wx.reLaunch({ url });
    } catch (err) {
      showToast(err.message || '登录失败', 'error');
    } finally {
      this.setData({ submitting: false });
    }
  },

  goOnboard() {
    wx.navigateTo({ url: '/pages/mentor-onboard/mentor-onboard' });
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/parent-register/parent-register?mode=create' });
  }
});
