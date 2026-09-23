# 星火学伴 · 生产部署指南

本文档说明如何将「星火学伴」部署到生产环境。

## 目录

- [项目概述](#项目概述)
- [架构说明](#架构说明)
- [前置准备](#前置准备)
- [API 后端部署](#api-后端部署)
- [前端部署](#前端部署)
- [小程序配置](#小程序配置)
- [客户待办清单](#客户待办清单)
- [常见问题](#常见问题)

---

## 项目概述

**产品名称**：星火学伴  
**运营主体**：成都励德科技发展有限公司  
**技术栈**：
- 前端：静态 HTML + Vanilla JS（GitHub Pages）
- 后端：Node.js + Express + SQLite/JSON
- 小程序：微信原生小程序
- 支付：微信支付（JSAPI / 小程序支付）
- 短信：阿里云 / 腾讯云

---

## 架构说明

```
┌─────────────────┐      HTTPS       ┌──────────────────┐
│  GitHub Pages   │ ───────────────> │   API Server     │
│  (Web 前端)     │                   │   (Render/Railway)│
└─────────────────┘                   └──────────────────┘
                                              │
┌─────────────────┐      HTTPS               ├─> SQLite/JSON DB
│  微信小程序      │ ───────────────> │       ├─> 短信服务 (阿里云/腾讯云)
│  (家长端)       │                   │       └─> 微信支付
└─────────────────┘                   
```

---

## 前置准备

### 1. 公司资质与账号

✅ **已确认**：
- 运营主体：成都励德科技发展有限公司
- 产品名称：星火学伴

⏳ **待客户提供**：
- 统一社会信用代码（工商注册后）
- 客服电话
- 办公地址

### 2. 第三方服务账号

需要客户完成以下进件/开通：

#### 微信相关
- [ ] 微信小程序账号（需企业认证）
- [ ] 微信商户号（微信支付）
  - 商户号 (MCH_ID)
  - API v3 密钥
  - 商户证书（序列号 + 私钥 PEM）
  - 小程序 AppID

#### 短信服务（二选一）
- [ ] 阿里云短信服务
  - AccessKey ID / Secret
  - 短信签名（需报备）
  - 短信模板 ID（需审核）
- [ ] 腾讯云短信服务
  - AppID / AppKey
  - 短信签名（需报备）
  - 短信模板 ID（需审核）

#### 域名与服务器
- [ ] API 域名（如 `api.xinghuo-xueban.com`）
- [ ] 云服务账号（Render / Railway / Fly.io / 阿里云）

---

## API 后端部署

### 选项 A：Render.com（推荐）

1. **Fork 代码仓库到客户 GitHub 账号**

2. **在 Render 创建 Web Service**
   - 登录 [render.com](https://render.com)
   - 点击 **New +** → **Web Service**
   - 连接 GitHub 仓库
   - 设置：
     - **Name**: `xinghuo-api`
     - **Root Directory**: `_platform/server`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: 选择合适的套餐（Free / Starter）

3. **配置环境变量**

   在 Render Dashboard → Environment 添加：

   ```env
   NODE_ENV=production
   PORT=8787
   DATABASE_PATH=./data/db.json
   
   # CORS（逗号分隔，添加 GitHub Pages 和自定义域名）
   CORS_ORIGINS=https://vvmashimaro.github.io,https://your-custom-domain.com
   
   # 管理员令牌（用于保护重置接口）
   ADMIN_TOKEN=your-secure-random-token-here
   
   # 短信配置（阿里云示例）
   SMS_PROVIDER=aliyun
   ALIYUN_ACCESS_KEY_ID=your-access-key-id
   ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret
   ALIYUN_SMS_SIGN_NAME=星火学伴
   ALIYUN_SMS_TEMPLATE_CODE=SMS_123456789
   
   # 微信支付配置
   WECHAT_MCH_ID=your-mch-id
   WECHAT_APP_ID=your-appid
   WECHAT_API_V3_KEY=your-api-v3-key
   WECHAT_MCH_SERIAL_NO=your-serial-no
   WECHAT_PRIVATE_KEY_PEM=your-private-key-content-with-\n
   WECHAT_NOTIFY_URL=https://your-api.onrender.com/api/pay/wechat/notify
   
   # API 公开地址
   API_PUBLIC_URL=https://your-api.onrender.com
   ```

4. **部署**
   - 点击 **Create Web Service**
   - Render 会自动构建并部署
   - 部署完成后获得 URL（如 `https://xinghuo-api.onrender.com`）

5. **验证部署**
   ```bash
   curl https://your-api.onrender.com/api/health
   ```

### 选项 B：Railway.app

1. 登录 [railway.app](https://railway.app)
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择仓库和分支
4. 设置 Root Directory: `_platform/server`
5. 添加环境变量（同上）
6. 配置自定义域名
7. 部署

### 选项 C：Fly.io

1. 安装 Fly CLI：`curl -L https://fly.io/install.sh | sh`
2. 登录：`flyctl auth login`
3. 在 `_platform/server` 目录创建 `fly.toml`：

```toml
app = "xinghuo-api"
primary_region = "sin"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

4. 部署：
   ```bash
   cd _platform/server
   fly launch --no-deploy
   fly secrets set NODE_ENV=production ADMIN_TOKEN=xxx ...
   fly deploy
   ```

---

## 前端部署

### GitHub Pages（推荐）

1. **更新 `js/config.js`**
   ```javascript
   window.XH_CONFIG = {
     API_BASE: 'https://your-api.onrender.com', // 替换为实际 API 地址
     SMS_MODE: 'production',
     PAY_MODE: 'production',
     ALLOW_DEMO_SMS: false
   };
   ```

2. **提交并推送**
   ```bash
   git add js/config.js
   git commit -m "配置生产 API 地址"
   git push origin main
   ```

3. **启用 GitHub Pages**
   - 进入仓库 Settings → Pages
   - Source: `main` 分支，`/ (root)` 目录
   - 保存后等待部署
   - 访问 `https://username.github.io/xinghuo-xueban/login.html`

4. **自定义域名（可选）**
   - 在域名 DNS 添加 CNAME 记录指向 `username.github.io`
   - 在 GitHub Pages 设置中填入自定义域名
   - 等待 SSL 证书自动配置

---

## 小程序配置

### 1. 更新配置文件

编辑 `_platform/miniprogram/utils/config.js`：

```javascript
module.exports = {
  API_BASE: 'https://your-api.onrender.com', // 生产 API
  PAY_MODE: 'production',
  SMS_MODE: 'production'
};
```

### 2. 小程序管理后台配置

登录 [微信公众平台](https://mp.weixin.qq.com)：

#### 配置服务器域名
- 进入：开发 → 开发管理 → 开发设置 → 服务器域名
- **request 合法域名**：添加 `https://your-api.onrender.com`
- **uploadFile 合法域名**：（如需上传）同上
- **downloadFile 合法域名**：（如需下载）同上

#### 配置业务域名（可选）
- 如需使用 web-view 组件，在「业务域名」中添加

### 3. 上传代码

1. 使用微信开发者工具打开 `_platform/miniprogram` 目录
2. 填入 AppID（从小程序管理后台获取）
3. 点击「上传」按钮
4. 填写版本号和备注
5. 在管理后台提交审核

### 4. 微信支付配置

在小程序管理后台：
- 关联微信商户号
- 配置支付密钥
- 测试支付流程

---

## 客户待办清单

### 🔴 紧急（上线必需）

1. **公司资质**
   - [ ] 提供统一社会信用代码
   - [ ] 提供客服电话
   - [ ] 提供公司详细地址

2. **微信小程序**
   - [ ] 注册微信小程序账号（企业认证）
   - [ ] 获取小程序 AppID
   - [ ] 配置服务器域名

3. **微信支付**
   - [ ] 开通微信商户号
   - [ ] 完成商户进件
   - [ ] 获取商户号、API密钥、证书
   - [ ] 关联小程序

4. **短信服务**
   - [ ] 选择短信服务商（阿里云或腾讯云）
   - [ ] 开通短信服务
   - [ ] 申请短信签名（需1-3工作日审核）
   - [ ] 申请短信模板（需1-3工作日审核）

5. **域名与部署**
   - [ ] 注册 API 域名（可选）
   - [ ] 选择云服务平台（Render/Railway/Fly.io）
   - [ ] 完成后端部署
   - [ ] 配置环境变量

### 🟡 重要（上线优化）

6. **法律文档**
   - [ ] 委托律师审定《服务协议》
   - [ ] 委托律师审定《个人信息保护政策》
   - [ ] 补充完整联系方式

7. **运营准备**
   - [ ] 设计小程序 Logo 和封面
   - [ ] 准备小程序介绍文案
   - [ ] 制作用户使用指南

### 🟢 增强（后续迭代）

8. **监控与日志**
   - [ ] 配置服务器监控（Uptime Robot / Pingdom）
   - [ ] 配置错误日志收集（Sentry）
   - [ ] 配置性能监控

9. **备份与安全**
   - [ ] 配置数据库定期备份
   - [ ] 配置 SSL 证书自动续期
   - [ ] 配置防火墙和访问限制

---

## 常见问题

### Q: 为什么 API 必须使用 HTTPS？

A: GitHub Pages 和微信小程序都要求通过 HTTPS 访问外部 API，否则会被浏览器或小程序拒绝。Render、Railway、Fly.io 等平台都自动提供免费 HTTPS 证书。

### Q: 短信签名和模板审核需要多久？

A: 通常 1-3 个工作日。建议提前申请，并准备好企业资质证明。模板内容需符合运营商规范，避免营销类词汇。

### Q: 微信支付开通需要什么条件？

A: 需要企业营业执照、对公账户、法人身份证等。个体工商户也可申请，但需提供更多材料。审核时间通常 1-7 个工作日。

### Q: 数据库会不会丢失？

A: 目前使用 JSON 文件存储。生产环境建议：
- 配置自动备份（Render 提供持久化磁盘）
- 定期导出数据库快照（通过 `/api/snapshot` 接口）
- 或迁移到 PostgreSQL / MongoDB

### Q: 如何更新线上代码？

A: 
- **前端**：修改后 `git push`，GitHub Pages 自动重新部署（1-2分钟）
- **后端**：`git push` 后 Render/Railway 自动触发重新构建（3-5分钟）
- **小程序**：使用开发者工具上传代码，提交审核（1-7天）

### Q: 如何查看 API 日志？

A:
- **Render**: Dashboard → Logs
- **Railway**: Project → Deployments → Logs
- **Fly.io**: `flyctl logs`

### Q: Mock 支付如何测试？

A: 开发环境下：
1. 调用 `POST /api/pay/wechat/prepay` 创建订单，获得 `outTradeNo`
2. 调用 `POST /api/pay/wechat/mock-confirm` 并传入 `outTradeNo` 模拟支付成功
3. 生产环境此接口会被禁用

---

## 技术支持

如有部署问题，请联系开发团队：
- 邮箱：dev@xinghuo-xueban.com
- 文档版本：v1.0
- 更新日期：2026-09-23

---

**祝部署顺利！🚀**
