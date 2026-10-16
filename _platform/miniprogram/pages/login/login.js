const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

const appConfig = require('../../utils/config');
const warehouseOn = !!appConfig.FEATURE_SMART_WAREHOUSE;

const ROLE_META = {
  mentor: {
    title: '伴读导师端登录',
    subtitle: warehouseOn
      ? '资金保障 · 免押扫码开启智能教学仓'
      : '资金保障 · 阳光透明接单授课'
  },
  parent: {
    title: '家长 / 学员登录',
    subtitle: warehouseOn
      ? '单次约课零预付 · 优选双一流学霸与合规微空间'
      : '单次约课零预付 · 优选双一流学霸导师'
  }
};

async function resolvePostLoginTarget(user) {
  if (user.role === 'mentor') {
    await Storage.hydrateFromServer();
    const mentor = await Storage.getCurrentMentor();
    if (mentor && mentor.status === 'approved') {
      return { url: '/pages/mentor-dashboard/mentor-dashboard', title: '导师工作台', toast: '欢迎回来' };
    }
    return { url: '/pages/mentor-onboard/mentor-onboard', title: '导师入库招募页', toast: '首次登录，请先完成导师建档认证' };
  }
  await Storage.hydrateFromServer();
  const parent = await Storage.getCurrentParent();
  if (parent) {
    return { url: '/pages/parent-dashboard/parent-dashboard', title: '家长主控与智能匹配', toast: '欢迎回来' };
  }
  return { url: '/pages/parent-register/parent-register?mode=create', title: '学情建档与注册', toast: '首次登录，请先完善学员学情建档' };
}

Page({
  data: {
    role: 'mentor',
    heroSub: warehouseOn
      ? '阳光课业辅导 · 智能微仓 · 课酬资金保障'
      : '阳光课业辅导 · 导师匹配 · 课酬资金保障',
    roleTitle: ROLE_META.mentor.title,
    roleSubtitle: ROLE_META.mentor.subtitle,
    mobile: '',
    smsCode: '',
    agreed: false,
    submitting: false,
    autoEntering: false,
    showFallback: false,
    fallbackUrl: '',
    fallbackTitle: '',
    smsCooldown: 0
  },

  async onLoad() {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    await this.tryAutoEnter();
  },

  onUnload() {
    if (this._smsTimer) clearInterval(this._smsTimer);
    if (this._navWatch) clearTimeout(this._navWatch);
  },

  onSwitchRole(e) {
    const role = e.currentTarget.dataset.role;
    const meta = ROLE_META[role];
    this.setData({
      role,
      roleTitle: meta.title,
      roleSubtitle: meta.subtitle,
      showFallback: false,
      agreed: false
    });
  },

  onMobile(e) { this.setData({ mobile: e.detail.value }); },
  onSms(e) { this.setData({ smsCode: e.detail.value }); },
  onToggleAgree() { this.setData({ agreed: !this.data.agreed }); },

  onShowProtocol(e) {
    e.stopPropagation();
    showToast('已调阅《星火学伴综合服务协议》');
  },

  onShowPrivacy(e) {
    e.stopPropagation();
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  async tryAutoEnter() {
    if (this._autoEnterDone || this.data.submitting) return;
    if (!Storage.isLoggedIn()) return;

    this.setData({ autoEntering: true });
    const session = await Storage.validateSession();
    if (!session.valid || !session.user) {
      this.setData({ autoEntering: false });
      return;
    }

    this._autoEnterDone = true;
    try {
      const target = await resolvePostLoginTarget(session.user);
      this.navigateReliably(target.url);
    } catch (e) {
      console.warn('[Login] auto enter failed', e);
      this._autoEnterDone = false;
      this.setData({ autoEntering: false });
    }
  },

  async onSendSms() {
    const mobile = (this.data.mobile || '').trim();
    if (!/^1[3-9]\d{9}$/.test(mobile) && mobile.length !== 11) {
      showToast('请输入有效的 11 位手机号码！', 'warning');
      return;
    }

    if (this.data.smsCooldown > 0) return;

    try {
      const result = await Storage.sendSMS(mobile, 'login');

      if (result.success) {
        showToast(result.message || '短信验证码已发送，请查收');

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
      console.error('SMS send error:', error);
      showToast('短信发送失败，请检查网络后重试', 'error');
    }
  },

  navigateReliably(url) {
    wx.reLaunch({
      url,
      fail: () => {
        wx.redirectTo({
          url,
          fail: () => {
            wx.navigateTo({
              url,
              fail: () => {
                this.setData({ showFallback: true });
                showToast('自动跳转未完成，请点击「手动进入」', 'warning');
              }
            });
          }
        });
      }
    });
  },

  handleNotRegistered(role, msg) {
    showToast(msg, 'warning');
    if (role === 'parent') {
      setTimeout(() => wx.navigateTo({ url: '/pages/parent-register/parent-register?mode=create' }), 600);
    } else if (role === 'mentor') {
      setTimeout(() => wx.navigateTo({ url: '/pages/mentor-onboard/mentor-onboard' }), 600);
    }
  },

  async completeLoginSuccess(loginResult, role) {
    const user = loginResult.user;
    const target = await resolvePostLoginTarget(user);

    if (target.toast) {
      showToast(target.toast);
    }

    this.setData({
      fallbackUrl: target.url,
      fallbackTitle: target.title
    });

    setTimeout(() => {
      this.navigateReliably(target.url);
      this._navWatch = setTimeout(() => {
        this.setData({ submitting: false, showFallback: true, autoEntering: false });
      }, 2500);
    }, 350);
  },

  async onSubmit() {
    const role = this.data.role;
    const mobile = (this.data.mobile || '').trim();
    if (!mobile) {
      showToast('请先输入手机号！', 'warning');
      return;
    }
    if (!this.data.agreed) {
      showToast('请阅读并勾选服务协议与隐私政策！', 'warning');
      return;
    }
    const code = (this.data.smsCode || '').trim();
    if (!code || code.length !== 6) {
      showToast('请输入 6 位短信验证码！', 'error');
      return;
    }

    this.setData({ submitting: true, showFallback: false });

    try {
      const verifyResult = await Storage.verifySMS(mobile, code, 'login');

      if (!verifyResult.success) {
        this.setData({ submitting: false });
        showToast(verifyResult.error || '验证码错误', 'error');
        return;
      }

      const ticket = verifyResult.ticket;
      if (!ticket) {
        this.setData({ submitting: false });
        showToast('验证成功但未获取到票据，请重试', 'error');
        return;
      }

      const loginResult = await Storage.login(ticket, role);

      if (!loginResult.success) {
        this.setData({ submitting: false });
        if (loginResult.notRegistered) {
          this.handleNotRegistered(role, loginResult.error || '该手机号未注册，请先完成注册');
          return;
        }
        showToast(loginResult.error || '登录失败', 'error');
        return;
      }

      await this.completeLoginSuccess(loginResult, role);
    } catch (error) {
      console.error('Login error:', error);
      this.setData({ submitting: false });
      showToast(error.message || '登录失败', 'error');
    }
  },

  async onWechatPhoneLogin(e) {
    if (!this.data.agreed) {
      showToast('请阅读并勾选服务协议与隐私政策！', 'warning');
      return;
    }

    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      showToast('已取消授权', 'warning');
      try {
        await Storage.auditLog('authorize_deny', 'wechat_auth_login', false);
      } catch (err) {
        console.warn('[Audit Log Error]', err);
      }
      return;
    }

    const code = e.detail.code;
    if (!code) {
      showToast('未获取到授权凭证，请重试或使用短信登录', 'warning');
      return;
    }

    const role = this.data.role;
    this.setData({ submitting: true, showFallback: false });

    try {
      const loginResult = await Storage.loginWithWeChatPhoneCode(code, role);

      if (!loginResult.success) {
        this.setData({ submitting: false });
        if (loginResult.notRegistered) {
          this.handleNotRegistered(role, loginResult.error || '该手机号未注册，请先完成注册');
          return;
        }
        showToast(loginResult.error || '本机号登录失败', 'error');
        return;
      }

      await this.completeLoginSuccess(loginResult, role);
    } catch (error) {
      console.error('[WeChat Phone Login Error]', error);
      this.setData({ submitting: false });
      showToast(error.message || '本机号登录失败，请使用短信登录', 'error');
    }
  },

  onManualEnter() {
    const url = this.data.fallbackUrl;
    if (!url) return;
    this.navigateReliably(url);
  },

  goOnboard() {
    wx.navigateTo({ url: '/pages/mentor-onboard/mentor-onboard' });
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/parent-register/parent-register?mode=create' });
  }
});
