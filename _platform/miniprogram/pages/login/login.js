const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

const ROLE_META = {
  mentor: {
    title: '青年导师端登录',
    subtitle: '银行合约直达秒结 · 免押扫码开启智能教学仓'
  },
  parent: {
    title: '家长 / 学员登录',
    subtitle: '单次约课零预付 · 优选双一流学霸与合规微空间'
  },
  admin: {
    title: '管理端入口',
    subtitle: '学信网核验 · 试讲量规 · 电子工牌发放'
  }
};

Page({
  data: {
    role: 'mentor',
    roleTitle: ROLE_META.mentor.title,
    roleSubtitle: ROLE_META.mentor.subtitle,
    mobile: '',
    smsCode: '',
    agreed: false,
    submitting: false,
    showFallback: false,
    fallbackUrl: '',
    fallbackTitle: '',
    smsCooldown: 0
  },

  async onLoad() {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
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

  async onSendSms() {
    const mobile = (this.data.mobile || '').trim();
    if (!/^1[3-9]\d{9}$/.test(mobile) && mobile.length !== 11) {
      showToast('请输入有效的 11 位手机号码！', 'warning');
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
          data: { phone: mobile, scene: 'login' },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        const msg = result.provider === 'mock' 
          ? '短信验证码已发送（演示可用：888888）'
          : '短信验证码已发送，请查收';
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
      console.error('SMS send error:', error);
      // 降级：演示模式
      showToast('API 连接失败，演示模式：验证码 888888', 'warning');
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
    }
  },

  resolveTarget(mobileVal) {
    const role = this.data.role;
    if (role === 'admin') {
      return { url: '/pages/admin-audit/admin-audit', title: '管理端质审台', toast: '' };
    }
    if (role === 'mentor') {
      const mentor = Storage.getMentorByPhone(mobileVal);
      if (mentor) {
        Storage.setSession({
          role: 'mentor',
          phone: mobileVal,
          mentorId: mentor.id,
          loggedInAt: new Date().toISOString()
        });
        return { url: '/pages/mentor-dashboard/mentor-dashboard', title: '导师工作台', toast: '欢迎回来' };
      }
      Storage.setSession({
        role: 'mentor',
        phone: mobileVal,
        loggedInAt: new Date().toISOString()
      });
      return { url: '/pages/mentor-onboard/mentor-onboard', title: '导师入库招募页', toast: '首次登录，请先完成导师建档认证' };
    }
    // parent：无档案 → 建档注册；有档案 → 主控
    const parents = Storage.getParents();
    const hit = parents.find((p) => p.phone === mobileVal);
    if (hit) {
      Storage.setSession({
        role: 'parent',
        phone: mobileVal,
        parentId: hit.id,
        loggedInAt: new Date().toISOString()
      });
      return {
        url: '/pages/parent-dashboard/parent-dashboard',
        title: '家长主控与智能匹配',
        toast: '欢迎回来'
      };
    }
    Storage.setSession({
      role: 'parent',
      phone: mobileVal,
      loggedInAt: new Date().toISOString()
    });
    return {
      url: '/pages/parent-register/parent-register?mode=create',
      title: '学情建档与注册',
      toast: '首次登录，请先完善学员学情建档'
    };
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

  async onSubmit() {
    const role = this.data.role;
    if (role === 'admin') {
      Storage.setSession({ role: 'admin', loggedInAt: new Date().toISOString() });
      this.setData({
        fallbackUrl: '/pages/admin-audit/admin-audit',
        fallbackTitle: '管理端质审台'
      });
      this.navigateReliably('/pages/admin-audit/admin-audit');
      return;
    }
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

    // 验证 SMS 验证码
    try {
      const config = require('../../utils/config');
      const apiBase = config.API_BASE || 'http://127.0.0.1:8787';

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${apiBase}/api/auth/sms/verify`,
          method: 'POST',
          data: { phone: mobile, code, scene: 'login' },
          success: resolve,
          fail: reject
        });
      });

      const result = res.data;

      if (res.statusCode === 200 && result.success) {
        // 验证成功，继续登录流程
        const target = this.resolveTarget(mobile);
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
            this.setData({ submitting: false, showFallback: true });
          }, 2500);
        }, 350);
      } else {
        this.setData({ submitting: false });
        showToast(result.error || '验证码错误', 'error');
      }
    } catch (error) {
      console.error('SMS verify error:', error);
      // 降级：演示模式验证
      if (code === '888888') {
        const target = this.resolveTarget(mobile);
        if (target.toast) {
          showToast(target.toast + '（演示模式）');
        }

        this.setData({
          fallbackUrl: target.url,
          fallbackTitle: target.title
        });

        setTimeout(() => {
          this.navigateReliably(target.url);
          this._navWatch = setTimeout(() => {
            this.setData({ submitting: false, showFallback: true });
          }, 2500);
        }, 350);
      } else {
        this.setData({ submitting: false });
        showToast('API 连接失败，演示模式请使用验证码 888888', 'warning');
      }
    }
  },

  onManualEnter() {
    const url = this.data.fallbackUrl;
    if (!url) return;
    this.navigateReliably(url);
  },

  goOnboard() {
    wx.navigateTo({ url: '/pages/mentor-onboard/mentor-onboard' });
  }
});
