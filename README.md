# 星火学伴

**运营主体**：成都励德科技发展有限公司  
**产品定位**：课业辅导撮合平台（家长-导师匹配、预约、支付、托管）

## 项目状态

✅ **已完成 (Production-Ready)**：
- 生产级 API 基础（环境变量、CORS白名单、安全防护）
- 短信验证码抽象层（支持阿里云/腾讯云/Mock）
- 微信支付集成（预支付、回调、Mock测试）
- 家长端微信小程序主路径对齐
- 法律文档（服务协议、隐私政策）更新公司主体

📋 **待客户提供**：
- 短信服务商密钥（阿里云或腾讯云）
- 微信商户号与支付证书
- 微信小程序 AppID
- 客服电话
- 生产 API 域名

详见 [DEPLOY.md](./DEPLOY.md) 完整部署指南。

---

## 快速开始

### 本地开发

#### 1. 启动 API 后端

```bash
cd _platform/server
npm install
# 复制环境变量模板并填入配置（开发环境可留空使用 mock）
cp .env.example .env
npm start
```

默认监听 `http://127.0.0.1:8787`

#### 2. 启动 Web 前端

```bash
python3 -m http.server 8080
# 访问 http://127.0.0.1:8080/login.html
```

#### 3. 小程序开发

使用微信开发者工具导入 `_platform/miniprogram/` 目录。

### 演示账号

- 家长手机号：`13980889211`
- 导师手机号：`13880123456`
- 演示验证码：`888888`（开发环境万能验证码）

---

## 项目结构

```
xinghuo-xueban/
├── index.html              # Web 家长端主页
├── login.html              # 登录页
├── parent_register.html    # 家长注册
├── parent_dashboard.html   # 家长仪表盘
├── mentor_dashboard.html   # 导师仪表盘
├── admin_audit.html        # 管理员审核
├── js/                     # Web 前端 JS
│   ├── config.js          # 🔧 API 配置
│   ├── legal-docs.js      # 法律文档
│   └── ...
├── docs/                   # 法律文档源文件
│   ├── 服务协议.md
│   └── 个人信息保护政策.md
├── _platform/
│   ├── server/            # Node.js API 后端
│   │   ├── src/
│   │   │   ├── index.js   # 主服务器
│   │   │   ├── db.js      # 数据库抽象
│   │   │   ├── sms.js     # 短信服务 ✨ 新增
│   │   │   └── wechat-pay.js # 微信支付 ✨ 新增
│   │   ├── .env.example   # 环境变量模板 ✨ 新增
│   │   └── package.json
│   └── miniprogram/       # 微信小程序（家长端）
│       ├── pages/
│       │   ├── login/
│       │   ├── parent-register/
│       │   ├── parent-dashboard/
│       │   └── ...
│       └── utils/
│           └── config.js  # 🔧 小程序 API 配置
├── DEPLOY.md              # 📘 部署指南 ✨ 新增
└── render.yaml            # Render.com 部署配置
```

---

## 生产部署

### 后端 API

推荐部署到 [Render.com](https://render.com)、[Railway.app](https://railway.app) 或 [Fly.io](https://fly.io)。

详见 [DEPLOY.md](./DEPLOY.md) 中的分步指南。

### 前端静态站

通过 GitHub Pages 部署：
1. 更新 `js/config.js` 中的 `API_BASE` 为生产 API 地址
2. 推送到 `main` 分支
3. 在仓库 Settings → Pages 启用

### 微信小程序

1. 更新 `_platform/miniprogram/utils/config.js`
2. 在小程序管理后台配置服务器域名（request 合法域名）
3. 使用开发者工具上传代码并提交审核

---

## API 接口

### 认证
- `POST /api/auth/sms/send` - 发送短信验证码 ✨
- `POST /api/auth/sms/verify` - 验证短信验证码 ✨

### 支付
- `POST /api/pay/wechat/prepay` - 创建微信预支付订单 ✨
- `POST /api/pay/wechat/notify` - 微信支付回调 ✨
- `POST /api/pay/wechat/mock-confirm` - Mock 支付确认（仅开发） ✨
- `GET /api/pay/orders/:outTradeNo` - 查询订单状态 ✨

### 用户
- `GET /api/mentors` - 获取导师列表
- `POST /api/mentors` - 导师注册
- `PATCH /api/mentors/:id` - 更新导师信息
- `GET /api/parents/phone/:phone` - 根据手机号查家长
- `POST /api/parents` - 家长注册/更新

### 预约
- `GET /api/bookings` - 获取预约列表
- `POST /api/bookings` - 创建预约
- `PATCH /api/bookings/:id` - 更新预约
- `POST /api/bookings/:id/respond` - 导师响应预约
- `POST /api/bookings/:id/complete` - 完成课程
- `POST /api/bookings/:id/summary` - 保存课后小结

### 其他
- `GET /api/health` - 健康检查
- `GET /api/snapshot` - 获取数据库快照
- `POST /api/snapshot` - 替换数据库快照 🔒 需要 ADMIN_TOKEN
- `POST /api/reset` - 重置数据库 🔒 需要 ADMIN_TOKEN

---

## 环境变量

生产环境必需配置：

```env
NODE_ENV=production
PORT=8787
CORS_ORIGINS=https://your-frontend-domain.com
ADMIN_TOKEN=your-secure-token

# 短信服务
SMS_PROVIDER=aliyun
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_SMS_SIGN_NAME=星火学伴
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxx

# 微信支付
WECHAT_MCH_ID=xxx
WECHAT_APP_ID=xxx
WECHAT_API_V3_KEY=xxx
WECHAT_MCH_SERIAL_NO=xxx
WECHAT_PRIVATE_KEY_PEM=xxx
WECHAT_NOTIFY_URL=https://your-api.com/api/pay/wechat/notify
```

完整配置见 `_platform/server/.env.example`

---

## 技术栈

- **前端**：HTML5 + Tailwind CSS + Vanilla JavaScript
- **后端**：Node.js 16+ + Express + dotenv
- **数据库**：SQLite (JSON兼容模式)
- **小程序**：微信原生小程序
- **支付**：微信支付 APIv3
- **短信**：阿里云短信 / 腾讯云短信
- **部署**：GitHub Pages (前端) + Render/Railway (后端)

---

## 许可

© 2026 成都励德科技发展有限公司 · 保留所有权利

---

**文档更新**：2026-09-23  
**联系方式**：support@xinghuo-xueban.com
