# 星火学伴 · 微信小程序演示版

将静态站 `xinghuo-xueban/` 的前端闭环移植为原生微信小程序（wxml / wxss / js / json），数据层使用 `wx.setStorageSync`，键名与种子数据与 Web 版 `js/storage-service.js` 对齐。

## 目录结构

```
xinghuo-xueban-miniprogram/
├── app.js / app.json / app.wxss
├── project.config.json          # compileType: miniprogram，appid: touristappid
├── sitemap.json
├── utils/
│   ├── storage.js               # StorageService 移植
│   ├── toast.js                 # 统一 wx.showToast（禁用 alert）
│   └── syllabus.js              # 分年级考纲考点库
├── pages/
│   ├── login/                   # 多角色登录
│   ├── mentor-onboard/          # 导师 L1/L2 建档
│   ├── admin-audit/             # 管理审核
│   ├── parent-register/         # 学情建档与注册 / 学员画像更改（edit 预填）
│   ├── parent-dashboard/        # 匹配约课 / 画像·护照 / 搜索筛选 / 托管 / IoT
│   └── mentor-dashboard/        # 审核状态 / 资料 / 申请箱
└── README.md
```

## 如何用微信开发者工具打开

1. 安装并打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择 **导入项目** / **打开项目**
3. 目录指向本文件夹 `xinghuo-xueban-miniprogram/`
4. AppID：
   - 可直接使用 **测试号 / 游客模式**：`project.config.json` 已填写 `touristappid`
   - 或替换为你自己的 AppID（把 `touristappid` 改成 `wxXXXXXXXXXXXXXXXX`，并在本 README 备注为 replace-me）
5. 后端服务 / 云开发：**不需要**。本演示纯前端本地存储。
6. 在模拟器中从「登录」页开始走完整闭环。

> 若提示「未开通相关能力」：游客 AppID 即可预览界面与本地存储逻辑；真机支付 / 真实短信 / 真实 IoT 不在演示范围。

## 演示账号

| 角色 | 手机号 | 验证码 | 说明 |
| --- | --- | --- | --- |
| 已入库导师 | `13880123456` | `888888` | 李思源 · 申请箱含待接单种子约课 |
| 演示家长 | `13980889211` | `888888` | 刘女士 / 乐乐同学 |
| 新导师 | 任意未登记号 | `888888` | 登录后进入 L1/L2 建档 |
| 管理端 | 切换「管理审核」角色 | — | 直接进入质审台 |

登录页协议勾选框 **默认未勾选**，需手动勾选后登录。

## 推荐演示路径

1. **登录** → 导师 `13880123456` + `888888` → 导师工作台 → 约课申请箱接单/婉拒  
2. **首次家长登录（新手机号）** → 家长角色 + 任意未登记号 + `888888` → Toast「首次登录，请先完善学员学情建档」→ **学情建档与注册**（`parent-register?mode=create`）→ 完成建档后进入主控  
3. **回访家长登录** → 家长 `13980889211` + `888888` → Toast「欢迎回来」→ **家长主控** → 顶部「**学员画像更改**」进入预填编辑（`?mode=edit`）→「保存画像并返回主控」；亦可「查阅学情护照」→「更新学情与考纲」  
4. **家长主控** → 搜索 / 学科芯片 / **网点空间**芯片 / 契合度·时薪排序 →「我的约课」状态；预约 → 托管摘要 → 电子协议 48h → `pending_accept`；约课后可关联 IoT 面板  
5. **管理审核** → 筛选待初审 → 核准/否决（展示案卷 id + 手机尾号）  
6. **新导师建档** → L1 进度清单 → L2 → 提交 pending → 工作台看待审  
7. **IoT** → 家长主控「模拟扫码开门」→ 按钮变为「已开门 · 灯光已通」→ 倒计时至 20:30（或演示 15s）→「已收课断电」

## 存储键映射（与 Web 一致）

| 键 | 含义 |
| --- | --- |
| `xh_mentors_v1` | 导师案卷 |
| `xh_parents_v1` | 家长档案 |
| `xh_bookings_v1` | 约课（含 `mentorId` / `pending_accept`） |
| `xh_contracts_v1` | 电子协议 |
| `xh_session_v1` | 当前会话角色 |
| `xh_seeded_v1` | 是否已种子化 |

主要 API：`seedIfEmpty` / `resetDemoData` / `addMentor` / `updateMentor` / `updateMentorProfile` / `getTutorListForParent` / `saveParent`（及别名 `addParent`）/ `addBooking` / `respondToBooking` / `getCurrentMentor` / `normalizeParentProfile` 等。

## 重置演示数据

在任意页面的调试器 Console 中执行（需先 `require` 或在管理端点击「重置演示数据」按钮）：

```js
const S = require('../../utils/storage'); // 路径以当前页为准，或在管理端点按钮
S.resetDemoData();
```

管理端质审台底部提供 **重置演示数据** 按钮，最方便。

也可在开发者工具 → 存储 → 清空 Storage 后重新编译，会自动 `seedIfEmpty`。

## 设计令牌

- Primary：`#0d9488`（teal-600）
- Dark：`#0f172a`（slate-900）
- 反馈统一 `showToast` / `wx.showToast`，禁止 `wx.showModal` 当作 alert 阻塞流程（婉拒等原因用自定义弹层）

## 说明与边界

- 无真实支付、短信网关、学信网接口、IoT 硬件；均为模拟器可走通的前端逻辑。
- 未使用 Tailwind CDN；样式为原生 wxss + CSS 变量。
- `app.json` 未启用 tabBar，登录后按角色 `reLaunch` / `navigateTo`。
