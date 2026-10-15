const Storage = require('../../utils/storage');
const Chsi = require('../../utils/chsi-verify');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    realName: '',
    phone: '',
    idCardMasked: '',
    bankName: '',
    bankMasked: '',
    chsiMasked: '',
    chsiStatus: '',
    chsiMajor: '',
    proofCount: 0,
    publicTeacherCompliance: true,
    sensitiveShow: false,
    sens: {
      realName: '', idCard: '', chsiCode: '', bankName: '', bankCardNumber: '', phone: '', note: ''
    }
  },

  async onShow() {
    await this.reload();
  },

  async reload() {
    if (Storage.ready) await Storage.ready();
    const mentor = this._loadMentor();
    if (!mentor) return;
    this._mentor = mentor;
    const idCard = String(mentor.idCard || '');
    const bank = String(mentor.bankCardNumber || '');
    const chsi = String(mentor.chsiCode || '');
    this.setData({
      realName: mentor.realName || '',
      phone: mentor.phone || '',
      idCardMasked: idCard ? idCard.slice(0, 6) + '********' + idCard.slice(-4) : '—',
      bankName: mentor.bankName || '—',
      bankMasked: bank ? bank.slice(0, 4) + ' **** **** ' + bank.slice(-4) : '—',
      chsiMasked: chsi ? chsi.slice(0, 4) + '****' + chsi.slice(-4) : '—',
      chsiStatus: mentor.chsiStatus || '待核验',
      chsiMajor: mentor.chsiMajor || '—',
      proofCount: (mentor.proofFiles || []).length,
      publicTeacherCompliance: !!mentor.publicTeacherCompliance
    });
  },

  _loadMentor() {
    Storage.seedIfEmpty();
    let mentor = Storage.getCurrentMentor();
    if (!mentor) {
      const session = Storage.getSession() || {};
      if (session.phone) mentor = Storage.getMentorByPhone(session.phone);
    }
    if (!mentor) {
      showToast('未找到导师档案', 'warning');
      wx.navigateBack();
      return null;
    }
    return mentor;
  },

  openChsiArchive() {
    Chsi.openChsiArchive();
  },
  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  openSensitive() {
    const m = this._mentor;
    this.setData({
      sensitiveShow: true,
      sens: {
        realName: m.realName || '',
        idCard: m.idCard || '',
        chsiCode: m.chsiCode || '',
        bankName: m.bankName || '招商银行',
        bankCardNumber: m.bankCardNumber || '',
        phone: m.phone || '',
        note: ''
      }
    });
  },
  closeSensitive() {
    this.setData({ sensitiveShow: false });
  },
  onSens(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['sens.' + k]: e.detail.value });
  },
  submitSensitive() {
    const m = this._mentor;
    const s = this.data.sens;
    const realName = (s.realName || '').trim();
    const idCard = (s.idCard || '').trim();
    const chsiCode = (s.chsiCode || '').trim();
    const bankCardNumber = (s.bankCardNumber || '').trim();
    if (!realName || idCard.length < 15) {
      showToast('请填写有效姓名与身份证号', 'warning');
      return;
    }
    if (!chsiCode || chsiCode.length < 10) {
      showToast('请填写有效学信网验证码', 'warning');
      return;
    }
    if (!bankCardNumber || bankCardNumber.length < 16) {
      showToast('请填写 16-19 位借记卡号', 'warning');
      return;
    }
    const patch = {
      realName,
      idCard,
      chsiCode,
      bankName: (s.bankName || '').trim() || '招商银行',
      bankCardNumber,
      phone: (s.phone || '').trim() || m.phone
    };
    if (s.note) {
      patch.reviewComment = '【敏感信息变更待复审】' + s.note;
    }
    Storage.updateMentorProfile(m.id, patch, { sensitiveChange: true });
    const session = Storage.getSession() || {};
    session.phone = patch.phone || session.phone;
    session.mentorId = m.id;
    Storage.setSession(session);
    this.setData({ sensitiveShow: false });
    showToast('已提交敏感变更，进入复审', 'warning');
    this.reload();
  }
});
