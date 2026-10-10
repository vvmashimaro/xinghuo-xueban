# 星火学伴 · 微信小程序（Greenfield / Style C）

本目录为 **2026 greenfield 重建**：旧 `pages/**` 实现已删除，全部页面使用新 wxml/wxss/js，视觉对齐 Web **Style C**（奶油底、#FF5A2D、桃→薰衣草渐变、气泡卡片、Logo 顶栏）。

数据层 **仅** 通过 `utils/storage.js`（与 `js/storage-service.js` 同 API 契约），无平行 mock 库。

## 页面 ↔ Web

| 小程序 | Web | 说明 |
| --- | --- | --- |
| `pages/login` | `login.html` | 角色分段、SMS 票据登录 |
| `pages/parent-register` | `parent_register.html` | 建档/画像、学科目录（考研/艺体/体育） |
| `pages/parent-dashboard` | `parent_dashboard.html` | Hub（匹配/约课）、筛选、仓位 chips、冲突强制约课 |
| `pages/mentor-onboard` | 导师入驻段 | L1/L2 建档 |
| `pages/mentor-dashboard` | `mentor_dashboard.html` | 申请箱、网点偏好 |
| `pages/profile` | 账户区 | 解绑/退出/注销 |
| `pages/privacy` | `privacy.html` | 隐私政策摘要 |

**管理端**：`admin-saas/`（Web）；小程序内 **无** `admin-audit` 页面。

## 保留文件

- `project.config.json` — AppID `wx5a978366a03285cb`
- `sitemap.json`
- `images/logo-xinghuo.jpg`
- `utils/config.js` — `API_BASE` `https://www.sparkles.com.cn`，`FEATURE_SMART_WAREHOUSE: false`，demo SMS/PAY
- `utils/storage.js` — 统一 API 客户端
- `utils/toast.js` — 提示
- `utils/syllabus.js` — 考纲弱项 UI（学科目录仍来自 `/api/subject-catalog`）

## API 端点（摘要）

认证、mentors/parents/bookings/contracts、subject-catalog、teaching-points、feature-flags、tutors/match、pay prepay/mock-confirm、feedback — 与 Web 相同，详见上一版矩阵；完整列表见 `utils/storage.js` 调用处。

## 样式

全局令牌与组件类在 `app.wxss`（`.shell`、`.xh-card`、`.hub-chip`、`.tutor-card`、`.modal-panel` 等），与 `css/xinghuo-tokens.css` 语义一致。
