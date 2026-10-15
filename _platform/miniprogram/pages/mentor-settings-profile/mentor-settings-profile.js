const Storage = require('../../utils/storage');
const Avail = require('../../utils/mentor-availability');
const { showToast } = require('../../utils/toast');

Page({
  data: {
    spaces: Storage.SPACE_OPTIONS || ['青羊金沙文化微网点', '高新大源中央微网点', '武侯川大望江微网点'],
    spaceIndex: 0,
    edit: { hourlyRate: '', scoreHighlight: '', lectureUrl: '' },
    weekdayRange: Avail.WEEKDAY_RANGE,
    selectedWeekday: 1,
    selectedWeekdayLabel: '周一',
    timeSlots: Avail.TIME_SLOTS,
    availability: {},
    activeSlotOn: {},
    availabilitySummary: ''
  },

  async onShow() {
    await this.reload();
  },

  async reload() {
    if (Storage.ready) await Storage.ready();
    Storage.seedIfEmpty();
    let mentor = Storage.getCurrentMentor();
    if (!mentor) {
      const session = Storage.getSession() || {};
      if (session.phone) mentor = Storage.getMentorByPhone(session.phone);
    }
    if (!mentor) {
      showToast('未找到导师档案', 'warning');
      wx.navigateBack();
      return;
    }
    this._mentor = mentor;
    const spaces = this.data.spaces;
    let spaceIndex = spaces.indexOf(mentor.spacePreference || (mentor.preferredSpaces && mentor.preferredSpaces[0]));
    if (spaceIndex < 0) spaceIndex = 0;
    const loaded = Avail.loadAvailabilityFromStorage(Storage.getMentorAvailability(mentor.id));
    this.setData({
      spaceIndex,
      edit: {
        hourlyRate: String(mentor.hourlyRate || ''),
        scoreHighlight: mentor.scoreHighlight || '',
        lectureUrl: mentor.lectureUrl || ''
      },
      availability: loaded.availability,
      selectedWeekday: loaded.selectedWeekday,
      selectedWeekdayLabel: loaded.selectedWeekdayLabel,
      activeSlotOn: loaded.activeSlotOn,
      availabilitySummary: Avail.summarizeAvailability(loaded.availability)
    });
  },

  onEdit(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ['edit.' + k]: e.detail.value });
  },
  onSpace(e) {
    this.setData({ spaceIndex: Number(e.detail.value) });
  },
  onWeekdayChange(e) {
    const index = Number(e.detail.value);
    const weekday = Avail.WEEKDAY_RANGE[index];
    const activeSlotOn = Object.assign({}, this.data.availability[weekday.value] || {});
    this.setData({
      selectedWeekday: weekday.value,
      selectedWeekdayLabel: weekday.label,
      activeSlotOn
    });
  },
  clearDay() {
    const wd = this.data.selectedWeekday;
    const availability = Object.assign({}, this.data.availability);
    availability[wd] = {};
    this.setData({ availability, activeSlotOn: {} });
    this.setData({ availabilitySummary: Avail.summarizeAvailability(availability) });
  },
  toggleSlot(e) {
    const slot = e.currentTarget.dataset.slot;
    const wd = this.data.selectedWeekday;
    const availability = Object.assign({}, this.data.availability);
    if (!availability[wd]) availability[wd] = {};
    else availability[wd] = Object.assign({}, availability[wd]);
    if (availability[wd][slot]) delete availability[wd][slot];
    else availability[wd][slot] = true;
    this.setData({
      availability,
      activeSlotOn: Object.assign({}, availability[wd])
    });
    this.setData({ availabilitySummary: Avail.summarizeAvailability(availability) });
  },

  saveProfile() {
    const m = this._mentor;
    if (!m) return;
    const availability = Avail.availabilityToArray(this.data.availability);
    const space = this.data.spaces[this.data.spaceIndex];
    Storage.setMentorAvailability(m.id, availability);
    Storage.updateMentorProfile(
      m.id,
      {
        hourlyRate: parseInt(this.data.edit.hourlyRate, 10) || m.hourlyRate,
        scoreHighlight: this.data.edit.scoreHighlight,
        lectureUrl: this.data.edit.lectureUrl,
        preferredSpaces: [space],
        spacePreference: space
      },
      { sensitiveChange: false }
    );
    showToast('画像已更新');
    this.reload();
  }
});
