# 星火学伴 · 微信小程序架构说明

本目录为 **Style C** 原生小程序（wxml / wxss / js），与 Web 静态站共用同一 Express API（`https://www.sparkles.com.cn`，本地联调见 README）。

## 页面 ↔ Web 对照

| 小程序页面 | Web 页面 | 主要能力 |
| --- | --- | --- |
| `pages/login/login` | `login.html` | 角色切换、SMS 发送/验证、票据登录 |
| `pages/parent-register/parent-register` | `parent_register.html` | 学情建档/画像编辑、学科目录、考研/艺体年级 |
| `pages/parent-dashboard/parent-dashboard` | `parent_dashboard.html` | 匹配列表、筛选、约课、仓位、冲突强制约课、托管/支付(demo) |
| `pages/mentor-onboard/mentor-onboard` | `mentor_dashboard.html`（入驻段） | L1/L2 导师建档提交 |
| `pages/mentor-dashboard/mentor-dashboard` | `mentor_dashboard.html` | 审核状态、档期、申请箱接单/婉拒 |
| `pages/profile/profile` | 各端账户区 | 手机绑定/解绑、注销 |
| `pages/privacy/privacy` | `privacy.html` | 隐私政策展示 |

管理审核（`admin-audit`）保留在仓库内作薄层参考；**正式管理在 Web `admin-saas/`**。

## 数据层

- **`utils/config.js`**：`API_BASE` 固定 `https://www.sparkles.com.cn`；`FEATURE_SMART_WAREHOUSE: false`；`PAY_MODE` / `SMS_MODE` 为 `demo`。
- **`utils/storage.js`**：与 `js/storage-service.js` 同契约——`wx.storage` 缓存 + `Authorization: Bearer <token>` 调用 `/api/*`。
- **`utils/toast.js`**、**`utils/syllabus.js`**：交互与考纲 UI 辅助（ syllabus 为本地考点库，学科目录来自 API）。

认证流：**SMS send → verify（ticket）→ login/register → hydrate**（拉 mentors/parents/bookings/contracts/assessments/feedback、feature-flags、teaching-points）。

## 使用的 API 端点（与 Web 一致）

| 领域 | 方法 | 路径 |
| --- | --- | --- |
| 健康/配置 | GET | `/api/feature-flags` |
| 学科目录 | GET | `/api/subject-catalog` |
| 教学点/仓位 | GET | `/api/teaching-points` |
| 认证 | POST | `/api/auth/sms/send`, `/api/auth/sms/verify`, `/api/auth/login`, `/api/auth/register`, `/api/auth/logout` |
| 认证 | GET | `/api/auth/me` |
| 微信手机 | POST | `/api/wx/phone`, `/api/auth/phone/bind`, `/api/auth/phone/unbind`, `/api/auth/phone/cancel`, `/api/auth/phone/audit` |
| 导师 | GET/POST/PATCH | `/api/mentors`, `/api/mentors/:id` |
| 家长 | GET/POST | `/api/parents` |
| 匹配 | POST | `/api/tutors/match` |
| 约课 | GET/POST/PATCH | `/api/bookings`, `/api/bookings/:id`, `/api/bookings/:id/respond` |
| 合约 | GET/POST | `/api/contracts` |
| 支付(demo) | POST | `/api/pay/wechat/prepay`, `/api/pay/wechat/mock-confirm` |
| 反馈 | GET/POST | `/api/feedback` |
| 测评 | GET/POST | `/api/assessments` |
| 会话 | PUT | `/api/session` |

约课冲突：服务端返回 `ok: false`, `code: STUDENT_TIME_CONFLICT`；家长端弹层后带 `timeConflictForced` 再次提交（与 Web 一致）。

## 视觉（Style C）

- 令牌见 `app.wxss`（cream `#FFF8F0`、主色 `#FF5A2D`、桃→薰衣草渐变、气泡卡片）。
- Logo：`images/logo-xinghuo.jpg`（与 `assets/logo-xinghuo.jpg` 同源）。

## 不在小程序内实现

- 生产 `.env`、真实短信/微信支付密钥（服务端配置，本 PR 不改动 `_platform/server` 密钥）。
- 智能仓 IoT（`FEATURE_SMART_WAREHOUSE` 为 false 时 UI 隐藏/降级）。
