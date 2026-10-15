# 微信支付接入说明

## 环境变量

在 `.env` 中配置（参见 `.env.example`）：

- `WECHAT_MCH_ID`、`WECHAT_APP_ID`、`WECHAT_API_V3_KEY`、`WECHAT_MCH_SERIAL_NO`
- `WECHAT_PRIVATE_KEY_PATH` 或 `WECHAT_PRIVATE_KEY_PEM`
- `WECHAT_NOTIFY_URL` — **须为公网 HTTPS**，如 `https://api.example.com/api/pay/wechat/notify`
- `WECHAT_APP_SECRET` + `WX_SESSION_MODE=production`（或 `WX_PHONE_MODE=production`）用于 `jscode2session` 获取 `openid`

配置不完整时，非生产环境仍走 **Mock 预支付** + `POST /api/pay/wechat/mock-confirm`。

## 接口

| 路径 | 说明 |
|------|------|
| `POST /api/wechat/jscode2session` | 小程序 `wx.login` code → 绑定家长 `wechatOpenid` |
| `POST /api/pay/wechat/prepay` | 创建预支付；body 可带 `wxCode`、`payType`（`JSAPI` / `NATIVE`） |
| `POST /api/pay/wechat/notify` | 微信异步通知（验签 + APIv3 解密） |

## 本地测试

```bash
cd _platform/server
node test-wechat-pay.js          # 解密 / Mock 预支付
# 完整预约 + Mock 支付见 run-test-suite.sh / test-miniprogram-flow.js
```

**Mock 路径（默认）**：不填商户密钥 → 预支付返回 `mock: true` → 前端 `PAY_MODE=demo` 自动 mock-confirm。

**真实路径**：填齐商户配置 + 备案 HTTPS 回调 → 小程序 `PAY_MODE=production`，预支付返回 `timeStamp` / `paySign` 等 → `wx.requestPayment`；Web 非微信内浏览器返回 `codeUrl` 展示 Native 扫码。
