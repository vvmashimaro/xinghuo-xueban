#!/usr/bin/env node
'use strict';

/**
 * 静态断言：Gemini UI 中期项（约课合并确认、顶栏分段、根路径分流、小程序履约）
 * 不启服务，只读仓库文件。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function count(src, re) {
  return (src.match(re) || []).length;
}

function main() {
  const parentDash = read('parent_dashboard.html');
  const indexHtml = read('index.html');
  const loginHtml = read('login.html');
  const consoleNav = read('js/console-nav.js');
  const tokens = read('css/tokens.css');
  const miniParentWxml = read('_platform/miniprogram/pages/parent-dashboard/parent-dashboard.wxml');
  const miniParentJs = read('_platform/miniprogram/pages/parent-dashboard/parent-dashboard.js');
  const miniMentorWxml = read('_platform/miniprogram/pages/mentor-dashboard/mentor-dashboard.wxml');
  const miniMentorJs = read('_platform/miniprogram/pages/mentor-dashboard/mentor-dashboard.js');
  const miniStorage = read('_platform/miniprogram/utils/storage.js');
  const adminWxml = read('_platform/miniprogram/pages/admin-audit/admin-audit.wxml');
  const adminJs = read('_platform/miniprogram/pages/admin-audit/admin-audit.js');
  const appJson = read('_platform/miniprogram/app.json');
  const appWxss = read('_platform/miniprogram/app.wxss');

  // 1) 约课漏斗：托管摘要 + 勾选签名同屏，不再弹出独立合同层
  assert.ok(parentDash.includes('confirmCombinedEscrowAndContract'), 'Web 合并确认提交');
  assert.ok(parentDash.includes('id="eContractAgreeCheck"'), '勾选协议在确认步');
  assert.ok(parentDash.includes('id="eContractSignName"'), '电子签名在确认步');
  assert.ok(parentDash.includes('微信支付 · 课次托管冻结'), '支付方式内联');
  assert.ok(!parentDash.includes('id="eContractModal"'), '已移除独立电子合同弹层');
  assert.ok(!parentDash.includes('id="paymentMethodModal"'), '支付方式弹窗仍不存在');
  assert.ok(parentDash.includes('下一步：确认并签署'), '配置步 CTA 为下一步');
  assert.ok(miniParentWxml.includes('onToggleContractAgree'), '小程序确认步含勾选');
  assert.ok(miniParentWxml.includes('onContractSign'), '小程序确认步含签名');
  assert.ok(!miniParentWxml.includes('bindtap="openContract"'), '小程序不再单独打开合同层');

  // 2) 顶栏紧凑分段 + 角标 + 推荐网格自适应
  assert.ok(consoleNav.includes('xh-console-seg'), 'Web 紧凑分段槽');
  assert.ok(consoleNav.includes('flex:0 0 auto') || consoleNav.includes('flex: 0 0 auto'), 'Tab 不拉满全宽');
  assert.ok(consoleNav.includes('setTabBadge'), 'Web Tab 角标 API');
  assert.ok(!consoleNav.includes('xh-console-fab'), 'Web 已移除重复 FAB');
  assert.ok(parentDash.includes('refreshParentCourseTabBadge'), '课程 Tab 待办角标');
  assert.ok(parentDash.includes('学情匹配维度'), '单导师时补充匹配维度卡');
  assert.ok(miniParentWxml.includes('console-tab-seg'), '小程序紧凑分段');
  assert.ok(miniParentWxml.includes('courseBadgeCount'), '小程序课程角标');
  assert.ok(!miniParentWxml.includes('fab-settings'), '家长小程序移除重复 FAB');
  assert.ok(!miniMentorWxml.includes('fab-settings'), '导师小程序移除重复 FAB');
  assert.ok(miniParentWxml.includes("consoleSection==='courses'"), '匹配精简条仅课程 Tab');

  // 3) 字号下限
  ['parent_dashboard.html', 'mentor_dashboard.html', 'login.html', 'parent_register.html'].forEach((f) => {
    const src = read(f);
    assert.strictEqual(count(src, /text-\[(?:9|10|11)px\]/g), 0, f + ' 应清退 9/10/11px');
  });
  assert.ok(tokens.includes('.xh-copy'), 'tokens 含正文类');
  assert.ok(tokens.includes('--type-xs: 12px'), 'tokens 字号下限仍在');

  // 4) 小程序履约
  assert.ok(miniParentWxml.includes('data-v="accepted"'), '家长筛选已接单');
  assert.ok(miniParentWxml.includes('data-v="completed"'), '家长筛选已完课');
  assert.ok(miniParentWxml.includes('data-v="cancelled"'), '家长筛选已取消');
  assert.ok(miniMentorWxml.includes('确认结课'), '导师确认结课');
  assert.ok(miniMentorWxml.includes('填写课后小结') || miniMentorWxml.includes('课后小结'), '导师课后小结');
  assert.ok(miniMentorWxml.includes('确认请假') && miniMentorWxml.includes('驳回请假'), '导师请假审批');
  assert.ok(miniStorage.includes('completeSession'), '小程序 storage 结课 API');
  assert.ok(miniStorage.includes("action: approve === false ? 'reject' : 'confirm'"), '小程序请假审批走现有 leave 接口');
  assert.ok(miniMentorJs.includes('Storage.completeSession'), '导师页调用结课');

  // 5) 根路径双入口
  assert.ok(indexHtml.includes('id="roleGate"'), '根路径角色分流');
  assert.ok(indexHtml.includes('我是家长（找导师）'), '家长入口文案');
  assert.ok(indexHtml.includes('我是导师（入驻）'), '导师入口文案');
  assert.ok(indexHtml.includes('shouldOpenMentorOnboard'), '深链/已登录导师可直达入驻');
  assert.ok(indexHtml.includes('entry=mentor') || indexHtml.includes("entry', 'mentor'"), '入驻路径带 entry=mentor');
  assert.ok(loginHtml.includes('login.html?role=parent') || loginHtml.includes("get('role')"), '登录可读 role 查询');
  assert.ok(loginHtml.includes('index.html?entry=mentor'), '登录入驻深链不丢入驻流');

  // 6) 管理端审核抽屉 + 危险重置
  assert.ok(adminWxml.includes('audit-drawer'), '案卷详情底部抽屉');
  assert.ok(adminWxml.includes('btn-danger-ghost'), '重置按钮危险样式');
  assert.ok(adminJs.includes('wx.showModal'), '重置二次确认');
  assert.ok(adminJs.includes('detailShow'), '选中后弹出详情');
  assert.ok(appJson.includes('pages/admin-audit/admin-audit'), 'admin-audit 已注册');

  assert.ok(!/FEATURE_SMART_WAREHOUSE\s*=\s*true/.test(read('js/feature-flags.js') + read('_platform/miniprogram/utils/config.js')), '仓位开关默认不应被打开');
  assert.ok(appWxss.includes('console-tab-seg'), '小程序 Tab 分段样式');
  assert.ok(!appWxss.includes('.fab-settings') && !appWxss.includes('.console-fab-sheet'), '小程序已清退重复 FAB 样式');
  assert.ok(!miniParentJs.includes('toggleConsoleFab') && !miniMentorJs.includes('toggleConsoleFab'), '小程序 JS 不再保留 FAB 入口');

  // 7) 新建学生/导师档案不出现主控台；工作台与运营中台仍保留
  const parentReg = read('parent_register.html');
  const mentorDash = read('mentor_dashboard.html');
  const adminHtml = read('admin-saas/index.html');
  const miniParentReg = read('_platform/miniprogram/pages/parent-register/parent-register.wxml');
  const miniMentorOnboard = read('_platform/miniprogram/pages/mentor-onboard/mentor-onboard.wxml');

  assert.ok(parentReg.includes('data-xh-archive="student"'), '新建学生档案默认标记为 student');
  assert.ok(/id="btnHeaderConsole"[^>]*data-xh-console[^>]*\bhidden\b/.test(parentReg), '新建学生档案顶栏主控台默认隐藏');
  assert.ok(parentReg.includes("setArchiveShell('student-edit')"), '仅更新已有画像时恢复返回主控');
  assert.ok(parentReg.includes("mode === 'student-edit'"), '返回主控只在 student-edit 打开');
  assert.ok(!parentReg.includes('console-nav.js'), '建档页不引入主控台分段脚本');
  assert.ok(!parentReg.includes('UserConsoleNavInit'), '建档页不挂分段主控台');

  assert.ok(indexHtml.includes("setAttribute('data-xh-archive', 'mentor')"), '导师建档直链在绘制前打上 mentor 标记');
  assert.ok(indexHtml.includes("setArchiveShell('mentor')"), '进入导师建档设置布局标记');
  assert.ok(indexHtml.includes("setArchiveShell('')"), '离开导师建档清除布局标记');
  assert.ok(!indexHtml.includes('主控台'), '新建导师档案页没有主控台入口');
  assert.ok(!indexHtml.includes('console-nav.js') && !indexHtml.includes('UserConsoleNavInit'), '导师建档页不挂分段主控台');

  assert.ok(tokens.includes('html[data-xh-archive="student"] [data-xh-console]'), '学生建档用布局标记隐藏主控台');
  assert.ok(tokens.includes('html[data-xh-archive="mentor"] [data-xh-console]'), '导师建档用布局标记隐藏主控台');
  assert.ok(!/data-xh-archive="student-edit"\]\s*\[data-xh-console\]/.test(tokens), '更新画像仍可显示返回主控');

  assert.ok(consoleNav.includes('archiveCreateHidesConsole'), '分段主控台识别建档壳');
  assert.ok(consoleNav.includes("mode === 'student'") && consoleNav.includes("mode === 'mentor'") && consoleNav.includes("mode === 'student-edit'"), '新建与更新档案都不挂分段条');

  assert.ok(parentDash.includes('js/console-nav.js') && parentDash.includes('UserConsoleNavInit'), '家长主控台仍挂分段条');
  assert.ok(!parentDash.includes('data-xh-archive'), '家长主控台不是建档壳');
  assert.ok(mentorDash.includes('js/console-nav.js') && mentorDash.includes('UserConsoleNavInit'), '导师工作台仍挂分段条');
  assert.ok(!mentorDash.includes('data-xh-archive'), '导师工作台不是建档壳');

  assert.ok(adminHtml.includes('<aside') && adminHtml.includes('data-nav="dashboard"'), '运营中台首页仍保留侧栏与总览');
  assert.ok(!adminHtml.includes('data-xh-archive'), '运营中台不走建档壳');

  assert.ok(!miniParentReg.includes('console-tab') && !miniParentReg.includes('主控台'), '小程序新建学生档案无主控台分段');
  assert.ok(!miniMentorOnboard.includes('console-tab') && !miniMentorOnboard.includes('主控台'), '小程序新建导师档案无主控台分段');
  assert.ok(miniParentWxml.includes('console-tab-bar') && miniMentorWxml.includes('console-tab-bar'), '小程序工作台仍保留主控台分段');

  console.log('✓ UI 中期静态结构 / 文案断言通过');
}

main();
