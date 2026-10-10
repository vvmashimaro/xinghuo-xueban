# 星火学伴 · 微信小程序（Greenfield）

**AppID**: `wx5a978366a03285cb`

本小程序为 **从零重建** 的 Style C 原生实现（非旧版换肤）。业务数据 **只** 走 `utils/storage.js` → `https://www.sparkles.com.cn/api/*`（与 Web `js/storage-service.js` 一致）。

详细架构见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 微信开发者工具

1. 导入目录：`_platform/miniprogram/`
2. AppID：`wx5a978366a03285cb`
3. **本地联调**：
   - 启动 `_platform/server`（`http://127.0.0.1:8787`）
   - 临时修改 `utils/config.js` 的 `API_BASE` 为局域网地址
   - **详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**
4. **生产**：`API_BASE` 保持 `https://www.sparkles.com.cn`，并在小程序后台配置 request 合法域名。

## 配置

| 键 | 值 |
| --- | --- |
| `API_BASE` | `https://www.sparkles.com.cn` |
| `FEATURE_SMART_WAREHOUSE` | `false` |
| `SMS_MODE` / `PAY_MODE` | `demo` |

## 页面一览

`login` · `parent-register` · `parent-dashboard` · `mentor-onboard` · `mentor-dashboard` · `profile` · `privacy`

## 测试

```bash
cd _platform/server && node test-miniprogram-flow.js
```

（需本机 API 已启动；不修改服务端密钥。）
