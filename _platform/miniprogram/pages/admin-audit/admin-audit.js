const Storage = require('../../utils/storage');
const { showToast } = require('../../utils/toast');

const STATUS_LABEL = {
  pending: '待初审',
  approved: '已入库',
  rejected: '已否决',
  supplement: '需补件'
};

Page({
  data: {
    filter: 'pending',
    keyword: '',
    list: [],
    selectedId: '',
    current: null,
    pendingCount: 0,
    approvedCount: 0,
    totalCount: 0,
    reviewComment: '',
    grades: ['V1 级标准导师', 'V2 级金牌导师', 'V3 级首席导师', '待教研评级'],
    gradeIndex: 1
  },

  async onShow() {
    this.reload();
  },

  reload() {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    const all = Storage.getMentors();
    const pendingCount = all.filter((m) => m.status === 'pending').length;
    const approvedCount = all.filter((m) => m.status === 'approved').length;
    let list = all.slice();
    if (this.data.filter !== 'all') {
      list = list.filter((m) => m.status === this.data.filter);
    }
    const kw = (this.data.keyword || '').trim().toLowerCase();
    if (kw) {
      list = list.filter((m) => {
        const phone = String(m.phone || '');
        const last4 = phone.slice(-4);
        const blob = (m.realName + m.code + m.university + phone + last4 + (m.subjects || []).join(' ')).toLowerCase();
        return blob.indexOf(kw) >= 0;
      });
    }
    list = list.map((m) => {
      const phone = String(m.phone || '');
      return Object.assign({}, m, {
        surname: (m.realName || '导').charAt(0),
        phoneLast4: phone.length >= 4 ? phone.slice(-4) : '----',
        statusLabel: STATUS_LABEL[m.status] || m.status,
        subjectsText: (m.subjects || []).slice(0, 3).join(' / ')
      });
    });
    // pending first
    list.sort((a, b) => {
      const order = { pending: 0, supplement: 1, approved: 2, rejected: 3 };
      return (order[a.status] || 9) - (order[b.status] || 9);
    });
    const selectedId = this.data.selectedId || (list[0] && list[0].id) || '';
    const current = list.find((m) => m.id === selectedId) || list[0] || null;
    this.setData({
      list,
      pendingCount,
      approvedCount,
      totalCount: all.length,
      selectedId: current ? current.id : '',
      current,
      reviewComment: (current && current.reviewComment) || ''
    });
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.f, selectedId: '' }, () => this.reload());
  },
  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.reload());
  },
  selectItem(e) {
    const id = e.currentTarget.dataset.id;
    const current = this.data.list.find((m) => m.id === id);
    this.setData({
      selectedId: id,
      current,
      reviewComment: (current && current.reviewComment) || ''
    });
  },
  onComment(e) { this.setData({ reviewComment: e.detail.value }); },
  onGrade(e) { this.setData({ gradeIndex: Number(e.detail.value) }); },

  onApprove() {
    const cur = this.data.current;
    if (!cur) return;
    Storage.updateMentor(cur.id, {
      status: 'approved',
      evalGrade: this.data.grades[this.data.gradeIndex],
      reviewComment: this.data.reviewComment || '试讲讲解清晰，资质齐备，予以准入入库。',
      sensitiveChangePending: false
    });
    showToast('已核准入库，家长端可见');
    this.reload();
  },
  onReject() {
    const cur = this.data.current;
    if (!cur) return;
    Storage.updateMentor(cur.id, {
      status: 'rejected',
      evalGrade: '不予评级',
      reviewComment: this.data.reviewComment || '不符合平台合规要求，予以否决。'
    });
    showToast('已否决驳回', 'warning');
    this.reload();
  },
  onSupplement() {
    const cur = this.data.current;
    if (!cur) return;
    Storage.updateMentor(cur.id, {
      status: 'supplement',
      evalGrade: '待复评',
      reviewComment: this.data.reviewComment || '材料不齐，请补交成绩单/试讲链接后复审。'
    });
    showToast('已打回补件', 'warning');
    this.reload();
  },
  goLogin() { wx.reLaunch({ url: '/pages/login/login' }); },
  resetDemo() {
    Storage.resetDemoData();
    showToast('演示数据已重置');
    this.setData({ selectedId: '' }, () => this.reload());
  }
});
