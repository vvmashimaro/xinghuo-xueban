/**
 * 首页「随便看看」展示名册。整表替换这一处即可换名单。
 * 只给落地页浏览用。浏览层会把每条强制标成未审核。
 * 不要把这里的人写入已审核导师，也不要拿这里的 id 去预约。
 *
 * 每条可用字段：
 * id, realName, university, major, subjects, styles, grades,
 * hourlyRate, scoreHighlight
 */
(function (root) {
  var roster = [];
  root.XINGHUO_BROWSE_DISPLAY_ROSTER = roster;
  if (typeof module === 'object' && module.exports) module.exports = roster;
})(typeof globalThis !== 'undefined' ? globalThis : this);
