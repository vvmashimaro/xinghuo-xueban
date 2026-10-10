# 星火学伴 · 微信小程序

**AppID**: `wx5a978366a03285cb`（见 `project.config.json`）

原生小程序，与 Web 站共用 **同一套 Express API**（`utils/storage.js` ↔ `js/storage-service.js`）。视觉为 **Style C**（奶油底、#FF5A2D 主色、桃→薰衣草渐变、气泡卡片 + 官方 Logo）。

架构与 API 对照见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 用微信开发者工具打开

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. **导入项目** → 目录选择本文件夹 `_platform/miniprogram/`
3. AppID 使用 `wx5a978366a03285cb`（已写在 `project.config.json`）
4. **本地联调 API**（可选）：
   - 在本机启动 `_platform/server`（默认 `http://127.0.0.1:8787`）
   - 临时把 `utils/config.js` 里的 `API_BASE` 改为电脑局域网地址（如 `http://192.168.x.x:8787`）
   - 打开 **详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**
5. 生产环境：`API_BASE` 保持 **`https://www.sparkles.com.cn`**，并在小程序后台配置该 request 合法域名。

## 配置说明

| 项 | 值 | 说明 |
| --- | --- | --- |
| `API_BASE` | `https://www.sparkles.com.cn` | 勿改为随意域名；本地调试见上 |
| `SMS_MODE` | `demo` | 演示验证码 `888888` |
| `PAY_MODE` | `demo` | 可走 mock 支付确认 |
| `FEATURE_SMART_WAREHOUSE` | `false` | 智能仓/IoT 暂缓 |

## 推荐演示路径

1. **登录** → 家长/导师 + 手机号 + `888888` → 票据登录  
2. **新家长** → 学情建档（学科含考研/艺体/体育）→ 家长主控匹配约课  
3. **约课** → 选教学点与 **仓位**（来自 `/api/teaching-points`）→ 冲突时可 **强制约课**  
4. **导师** → 入库 L1/L2 → 工作台接单  

演示账号（与 Web 种子一致，需服务端有数据）：导师 `13880123456`、家长 `13980889211`、验证码 `888888`。

## 目录结构

```
_platform/miniprogram/
├── app.js / app.json / app.wxss   # Style C 全局样式
├── project.config.json            # AppID wx5a978366a03285cb
├── images/logo-xinghuo.jpg
├── utils/config.js | storage.js | toast.js | syllabus.js
├── pages/login | parent-register | parent-dashboard
│         mentor-onboard | mentor-dashboard | profile | privacy
├── ARCHITECTURE.md
└── README.md
```

## 测试

- 服务端：`_platform/server/test-miniprogram-flow.js` 等（本 PR 不修改 server 业务逻辑）。
- 小程序：在开发者工具中走通登录 → 建档 → 主控约课 → 导师接单；本地联调务必勾选 **不校验合法域名**。
