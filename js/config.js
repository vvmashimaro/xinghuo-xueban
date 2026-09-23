/**
 * 星火学伴 · Web 端配置
 * 
 * 生产环境部署步骤：
 * 1. 将 API_BASE 改为生产 API 地址（必须 HTTPS，GitHub Pages 需要）
 * 2. 设置 SMS_MODE 为 'production' 启用真实短信
 * 3. 设置 PAY_MODE 为 'production' 启用真实支付
 * 4. 确保生产 API 已配置 CORS 允许当前域名
 */
window.XH_CONFIG = window.XH_CONFIG || {
  // API 基址（开发：本机；生产：HTTPS API）
  API_BASE: 'http://127.0.0.1:8787',
  // API_BASE: 'https://your-api.render.com', // 生产示例
  
  // 短信模式：demo（允许888888）、production（仅真实验证码）
  SMS_MODE: 'demo',
  
  // 支付模式：demo（允许mock）、production（仅真实支付）
  PAY_MODE: 'demo',
  
  // 允许演示验证码（仅在 SMS_MODE=demo 时生效）
  ALLOW_DEMO_SMS: true
};
