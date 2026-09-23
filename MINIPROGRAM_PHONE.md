# 微信小程序手机号授权 · 测试与合规指南

**产品**: 星火学伴  
**运营主体**: 成都励德科技发展有限公司  
**更新日期**: 2026-09-23

---

## 一、合规要点总结

### 1.1 隐私优先设计

✅ **已实现**：

- 隐私政策页面在授权前可访问（`pages/privacy/privacy`）
- 用户必须先阅读并同意隐私政策，才能看到手机号授权按钮
- 手机号收集场景明确标注："预约1对1线下伴学、课程联系通知"
- 前端展示全程脱敏（`138****8000`）
- 后端加密存储（AES-256-GCM）

### 1.2 用户主动授权

✅ **已实现**：

- 仅通过 `<button open-type="getPhoneNumber">` 用户点击触发
- 绝不在 `onLoad`/`onShow` 等生命周期自动调用
- 用户拒绝授权时，提供 SMS 手动输入备选方案

### 1.3 数据安全

✅ **已实现**：

- 手机号加密存储（需配置 `PHONE_ENCRYPTION_KEY`）
- 手机号哈希用于唯一性查询（HMAC-SHA256）
- 审计日志记录所有手机号操作（授权/绑定/解绑/注销）
- 无批量导出接口

---

## 二、测试账号与场景

### 2.1 开发环境 Mock 模式

当 `WX_PHONE_MODE=mock` 或未配置微信 AppID/AppSecret 时，系统自动进入 Mock 模式。

#### Mock Code 映射表

| Mock Code       | 返回手机号    | 说明           |
| --------------- | ------------- | -------------- |
| `MOCK_OK`       | 13980889211   | 标准授权成功   |
| `MOCK_PARENT_1` | 13880123456   | 家长账号1      |
| `MOCK_PARENT_2` | 15928114422   | 家长账号2      |
| `MOCK_MENTOR_1` | 18628009821   | 导师账号       |
| `MOCK_DENY`     | null          | 用户拒绝授权   |

#### 开发测试流程

1. **启动后端服务**（Mock 模式）

```bash
cd _platform/server
WX_PHONE_MODE=mock npm start
```

2. **微信开发者工具配置**

在 `_platform/miniprogram/utils/config.js` 设置：

```javascript
module.exports = {
  API_BASE: 'http://localhost:8787',
  WX_PHONE_MODE: 'mock'
};
```

3. **测试步骤**

- 打开 `pages/parent-register/parent-register`
- 勾选"我已阅读并同意《个人信息保护政策》"
- 点击"微信授权手机号"按钮
- Mock 模式会自动返回 `13980889211`
- 验证页面显示：`138****8211`

### 2.2 生产环境测试

#### 前置条件

1. 微信小程序已认证（企业账号）
2. 已配置服务器域名（request 合法域名）
3. 已配置环境变量：

```env
WECHAT_APP_ID=wxYOUR_APP_ID
WECHAT_APP_SECRET=YOUR_APP_SECRET
WX_PHONE_MODE=production
PHONE_ENCRYPTION_KEY=YOUR_64_CHAR_HEX_KEY
```

#### 测试场景

##### 场景1：授权成功

1. 用户进入注册页面
2. 勾选隐私政策同意
3. 点击"微信授权手机号（推荐）"
4. 微信弹出授权框，用户点击"允许"
5. ✅ 页面显示：`已授权手机号: 138****8000`
6. 后端日志记录：`action: authorize_ok`

##### 场景2：用户拒绝授权

1. 用户进入注册页面
2. 勾选隐私政策同意
3. 点击"微信授权手机号（推荐）"
4. 微信弹出授权框，用户点击"拒绝"
5. ✅ 显示提示："已取消授权"
6. ✅ 自动展开"手动输入手机号验证"选项
7. 后端日志记录：`action: authorize_deny`

##### 场景3：SMS 备用方案

1. 用户点击"手动输入手机号验证"
2. 输入手机号：`13980889211`
3. 点击"获取验证码"
4. 收到短信验证码（或使用演示码 `888888`）
5. 输入验证码并点击"验证并绑定"
6. ✅ 页面显示：`已授权手机号: 139****9211`
7. 后端日志记录：`action: bind, source: sms_verify`

##### 场景4：一号一户限制

1. 用户A用手机号 `13980889211` 完成注册
2. 用户B尝试用同一手机号注册
3. ✅ 显示错误："该手机号已被其他账号绑定"

---

## 三、审计日志验证

### 3.1 查看审计日志

所有手机号操作都会记录到 `phoneAuditLogs` 表，包含：

- `timestamp`: 操作时间
- `userId`: 用户ID
- `action`: 操作类型（`authorize_ok`, `authorize_deny`, `bind`, `unbind`, `cancel`）
- `source`: 来源（`wechat_auth`, `sms_verify`）
- `phoneHash`: 手机号哈希（不可逆）
- `ip`: 客户端IP
- `ua`: User-Agent
- `success`: 是否成功
- `error`: 错误信息（如有）

### 3.2 审计日志示例

```json
{
  "id": "AUDIT-L3M9K2-123",
  "timestamp": "2026-09-23 15:30:45",
  "userId": "PAR-DEMO-001",
  "action": "authorize_ok",
  "source": "wechat_auth",
  "phoneHash": "a7f3b8c9d1e2f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
  "ip": "180.168.12.34",
  "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) ...",
  "success": true,
  "error": ""
}
```

---

## 四、隐私政策页面要求

### 4.1 页面路径

- 小程序内：`pages/privacy/privacy`
- 静态页面：`/privacy.html`（GitHub Pages 可访问）

### 4.2 必须包含内容

✅ **已实现**：

1. **运营主体**：成都励德科技发展有限公司
2. **产品名称**：星火学伴
3. **收集场景**：
   - ✓ 预约1对1线下伴学服务的联系与确认
   - ✓ 课程安排变更、取消等重要通知
   - ✓ 课程开始前的提醒通知
4. **承诺事项**：
   - ✓ 不用于营销推广
   - ✓ 不出售、出租或分享给第三方
   - ✓ 不用于服务范围外的其他用途
5. **安全措施**：
   - ✓ AES-256 加密存储
   - ✓ 展示脱敏处理
   - ✓ 访问控制
6. **用户权利**：
   - ✓ 查看（脱敏）
   - ✓ 解绑
   - ✓ 注销
7. **联系方式**：
   - 运营主体、产品名称、联系邮箱

### 4.3 微信审核要点

提交小程序审核时，需要在"用户隐私保护指引"中填写：

```
【个人信息收集使用清单】
1. 手机号码
2. 收集场景：预约1对1线下伴学、课程通知
3. 收集方式：用户主动授权（微信官方接口）或手动输入验证
4. 使用目的：课程预约确认、变更通知
5. 是否共享给第三方：否
6. 隐私政策链接：https://您的域名/privacy.html
```

---

## 五、前后端对接测试清单

### 5.1 后端接口测试

#### `POST /api/wx/phone`

**请求**：

```bash
curl -X POST http://localhost:8787/api/wx/phone \
  -H "Content-Type: application/json" \
  -d '{"code":"MOCK_OK","userId":"test-user-001"}'
```

**期望响应**（200）：

```json
{
  "success": true,
  "phone": "13980889211",
  "countryCode": "86",
  "masked": "139****9211"
}
```

#### `POST /api/auth/phone/bind`

**请求**：

```bash
curl -X POST http://localhost:8787/api/auth/phone/bind \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-001","phone":"13980889211","source":"wechat_auth"}'
```

**期望响应**（200）：

```json
{
  "success": true,
  "masked": "139****9211"
}
```

#### `GET /api/auth/me?userId=test-user-001`

**期望响应**（200）：

```json
{
  "userId": "test-user-001",
  "phone": "139****9211",
  "phoneBoundAt": "2026-09-23 15:30:45",
  "phoneSource": "wechat_auth"
}
```

### 5.2 小程序端测试

#### 测试清单

- [ ] 隐私政策页面可正常访问
- [ ] 未勾选隐私政策时，授权按钮不可见
- [ ] 勾选隐私政策后，授权按钮可见
- [ ] 点击"微信授权手机号"触发原生授权弹窗
- [ ] 授权成功后显示脱敏手机号
- [ ] 授权失败后显示SMS备用方案
- [ ] SMS验证码发送成功
- [ ] SMS验证码验证成功并绑定
- [ ] 提交注册前验证手机号已授权
- [ ] 重复手机号绑定被拒绝

---

## 六、常见问题

### Q1: 开发工具无法触发 `getPhoneNumber`？

**A**: 微信开发者工具不支持真实手机号授权，需要使用真机调试或体验版测试。开发期间使用 Mock 模式。

### Q2: 如何生成 `PHONE_ENCRYPTION_KEY`？

**A**: 运行以下命令生成64位随机十六进制字符串：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Q3: 审计日志保留多久？

**A**: 当前实现保留最近10000条记录。生产环境建议定期归档到外部存储。

### Q4: 如何处理用户注销请求？

**A**: 调用 `POST /api/auth/phone/cancel`，用户账号及手机号信息将被永久删除。建议在注销前提示用户完成所有待结算事项。

### Q5: 隐私政策页面必须托管在公网吗？

**A**: 是的。微信审核时需要验证隐私政策URL可公开访问。建议：
- 小程序内：`pages/privacy/privacy`（审核查看）
- 公网静态页：`https://your-domain.com/privacy.html`（提交审核时填写）

---

## 七、部署检查清单

### 7.1 后端配置

- [ ] 设置 `WECHAT_APP_ID`
- [ ] 设置 `WECHAT_APP_SECRET`
- [ ] 设置 `PHONE_ENCRYPTION_KEY`（至少32字符）
- [ ] 设置 `WX_PHONE_MODE=production`
- [ ] 配置 `SMS_TEMPLATE_BOOKING`（预约成功通知）

### 7.2 小程序配置

- [ ] 在小程序管理后台配置 request 合法域名
- [ ] 在"用户隐私保护指引"中填写手机号收集说明
- [ ] 上传代码并提交审核
- [ ] 提供隐私政策公网URL

### 7.3 合规检查

- [ ] 隐私政策页面可访问（小程序内 + 公网）
- [ ] 手机号授权必须用户主动点击
- [ ] 手机号展示全程脱敏
- [ ] 审计日志正常记录
- [ ] 用户可解绑/注销手机号

---

## 八、微信审核注意事项

1. **隐私政策必须在授权前可见**  
   审核人员会检查是否在调用 `getPhoneNumber` 前展示隐私政策。

2. **不能自动弹出授权**  
   不能在页面加载时自动触发授权弹窗，必须用户主动点击。

3. **明确收集用途**  
   隐私政策中必须清晰说明手机号用途，不能含糊其辞。

4. **提供联系方式**  
   隐私政策页面必须包含运营主体、产品名称、联系邮箱。

5. **公网可访问**  
   审核时提交的隐私政策URL必须公网可访问（GitHub Pages即可）。

---

## 九、技术支持

如有问题，请联系：

- **技术支持邮箱**: dev@xinghuo-xueban.com
- **隐私咨询邮箱**: privacy@xinghuo-xueban.com
- **文档版本**: v1.0
- **更新日期**: 2026-09-23

---

**祝测试顺利！🎉**
