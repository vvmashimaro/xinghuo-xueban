/**
 * 首页「随便看看」展示名册。整表替换这一处即可换名单。
 * 只给落地页浏览用。浏览层会把每条强制标成未审核。
 * 不要把这里的人写入已审核导师，也不要拿这里的 id 去预约。
 *
 * 这份是已选定的十人名单。grades / subjects / styles 用来对上浏览筛选。
 */
(function (root) {
  var roster = [
    {
      id: 'browse-01',
      maskedName: '陈同学',
      university: '电子科技大学',
      major: '物理学',
      subjects: ['物理'],
      styles: ['拆题耐心'],
      grades: ['高一', '高二', '高三'],
      stageLabel: '高一–高三',
      priceBand: '¥150–200/时',
      scoreHighlight: '高考物理 142 分'
    },
    {
      id: 'browse-02',
      maskedName: '周同学',
      university: '西南交通大学',
      major: '英语',
      subjects: ['英语'],
      styles: ['跟读带练'],
      grades: ['小学高年级', '初一', '初二'],
      stageLabel: '小学高年级、初一、初二',
      priceBand: '¥90–130/时',
      scoreHighlight: '专业八级'
    },
    {
      id: 'browse-03',
      maskedName: '王同学',
      university: '四川大学',
      major: '汉语言文学',
      subjects: ['语文'],
      styles: ['引导启发'],
      grades: ['小学高年级', '初一', '初二'],
      stageLabel: '小学高年级、初一、初二',
      priceBand: '¥100–140/时',
      scoreHighlight: '高考语文 132 分'
    },
    {
      id: 'browse-04',
      maskedName: '吴同学',
      university: '电子科技大学',
      major: '数学与应用数学',
      subjects: ['数学'],
      styles: ['应试提分'],
      grades: ['高一', '高二', '高三'],
      stageLabel: '高一–高三',
      priceBand: '¥160–220/时',
      scoreHighlight: '高考数学 145 分'
    },
    {
      id: 'browse-05',
      maskedName: '李同学',
      university: '四川大学',
      major: '数学与应用数学',
      subjects: ['数学'],
      styles: ['引导启发'],
      grades: ['初一', '初二', '初三'],
      stageLabel: '初一–初三',
      priceBand: '¥120–160/时',
      scoreHighlight: '高考数学 141 分'
    },
    {
      id: 'browse-06',
      maskedName: '赵同学',
      university: '西华大学',
      major: '小学教育',
      subjects: ['小学数学', '小学全科'],
      styles: ['耐心陪练'],
      grades: ['一至六年级'],
      stageLabel: '一至六年级',
      priceBand: '¥70–100/时'
    },
    {
      id: 'browse-07',
      maskedName: '刘同学',
      university: '电子科技大学',
      major: '数学',
      subjects: ['考研数学'],
      styles: ['应试提分'],
      grades: ['考研'],
      stageLabel: '考研',
      priceBand: '¥180–240/时',
      scoreHighlight: '考研数学一 142 分'
    },
    {
      id: 'browse-08',
      maskedName: '黄同学',
      university: '西南大学',
      major: '生物科学',
      subjects: ['生物'],
      styles: ['知识框架梳理'],
      grades: ['高一', '高二', '高三'],
      stageLabel: '高一–高三',
      priceBand: '¥130–180/时',
      scoreHighlight: '高考生物 94 分'
    },
    {
      id: 'browse-09',
      maskedName: '孙同学',
      university: '四川大学',
      major: '汉语言文学',
      subjects: ['语文', '艺考文化课'],
      styles: ['作文审题与素材'],
      grades: ['高一', '高二', '高三'],
      stageLabel: '高一–高三',
      priceBand: '¥130–170/时',
      scoreHighlight: '高考语文 136 分'
    },
    {
      id: 'browse-10',
      maskedName: '郑同学',
      university: '电子科技大学',
      major: '计算机科学与技术',
      subjects: ['编程入门', '信息学'],
      styles: ['项目带练'],
      grades: ['初中', '高中'],
      stageLabel: '初中、高中',
      priceBand: '¥150–200/时',
      scoreHighlight: 'CSP-J 一等奖'
    }
  ];
  root.XINGHUO_BROWSE_DISPLAY_ROSTER = roster;
  if (typeof module === 'object' && module.exports) module.exports = roster;
})(typeof globalThis !== 'undefined' ? globalThis : this);
