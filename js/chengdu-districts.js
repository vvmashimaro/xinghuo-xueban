/**
 * 成都市家长建档 · 常住行政区
 * 网页（window.ChengduDistricts）与 Node / 小程序（module.exports）共用。
 * 小程序副本：_platform/miniprogram/utils/chengdu-districts.js（内容保持一致）。
 *
 * 12 个市辖区 + 产品里已有的高新区 + 天府新区（画像字段是字符串，不新增教学网点）+ 单独的「其他」。
 * 不收录都江堰、彭州等县级市。已存的「温江/其他」归一到温江区；无法识别的旧值原样保留，
 * 表单展示时再落到「其他」，避免无关保存把县级地名抹掉。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) root.ChengduDistricts = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  var OFFICIAL_DISTRICTS = [
    '锦江区',
    '青羊区',
    '金牛区',
    '武侯区',
    '成华区',
    '龙泉驿区',
    '青白江区',
    '新都区',
    '温江区',
    '双流区',
    '郫都区',
    '新津区'
  ];

  /** 高新区沿用现有选项；天府新区可写入 cityDistrict，不新增仓位/网点主数据。 */
  var PARENT_DISTRICT_OPTIONS = OFFICIAL_DISTRICTS.concat(['高新区', '天府新区', '其他']);

  var LEGACY_DISTRICT_ALIASES = {
    '温江/其他': '温江区',
    '温江': '温江区',
    '高新': '高新区',
    '成都高新区': '高新区',
    '天府': '天府新区',
    '天府新区成都直管区': '天府新区',
    '其他区域': '其他'
  };

  /**
   * 就近推荐仅在现有三个合规网点中选择，不发明新仓。
   * 北/西偏青羊金沙，中南偏武侯望江，南/东南偏高新大源。
   */
  var DISTRICT_TEACHING_POINT = {
    '锦江区': '武侯川大望江微网点',
    '青羊区': '青羊金沙文化微网点',
    '金牛区': '青羊金沙文化微网点',
    '武侯区': '武侯川大望江微网点',
    '成华区': '青羊金沙文化微网点',
    '龙泉驿区': '武侯川大望江微网点',
    '青白江区': '青羊金沙文化微网点',
    '新都区': '青羊金沙文化微网点',
    '温江区': '青羊金沙文化微网点',
    '双流区': '高新大源中央微网点',
    '郫都区': '青羊金沙文化微网点',
    '新津区': '高新大源中央微网点',
    '高新区': '高新大源中央微网点',
    '天府新区': '高新大源中央微网点',
    '其他': '青羊金沙文化微网点'
  };

  var SPACE_SHORT_LABEL = {
    '青羊金沙文化微网点': '青羊金沙微网点',
    '高新大源中央微网点': '高新大源微网点',
    '武侯川大望江微网点': '武侯川大微网点'
  };

  function normalizeCityDistrict(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (PARENT_DISTRICT_OPTIONS.indexOf(raw) >= 0) return raw;
    if (LEGACY_DISTRICT_ALIASES[raw]) return LEGACY_DISTRICT_ALIASES[raw];
    return raw;
  }

  function districtOptionFor(value) {
    var normalized = normalizeCityDistrict(value);
    if (PARENT_DISTRICT_OPTIONS.indexOf(normalized) >= 0) return normalized;
    return normalized ? '其他' : '';
  }

  function suggestSpaceForDistrict(value) {
    var option = districtOptionFor(value) || '其他';
    return DISTRICT_TEACHING_POINT[option] || DISTRICT_TEACHING_POINT['其他'];
  }

  function spaceShortLabel(space) {
    return SPACE_SHORT_LABEL[space] || space || '';
  }

  return {
    OFFICIAL_DISTRICTS: OFFICIAL_DISTRICTS,
    PARENT_DISTRICT_OPTIONS: PARENT_DISTRICT_OPTIONS,
    LEGACY_DISTRICT_ALIASES: LEGACY_DISTRICT_ALIASES,
    DISTRICT_TEACHING_POINT: DISTRICT_TEACHING_POINT,
    normalizeCityDistrict: normalizeCityDistrict,
    districtOptionFor: districtOptionFor,
    suggestSpaceForDistrict: suggestSpaceForDistrict,
    spaceShortLabel: spaceShortLabel
  };
});
