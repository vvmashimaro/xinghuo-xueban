/**
 * 星火学伴 · Web 端配置
 * 
 * 生产环境部署步骤：
 * 1. 将 API_BASE 改为生产 API 地址（必须 HTTPS，GitHub Pages 需要）
 * 2. 设置 SMS_MODE 为 'production' 启用真实短信
 * 3. 设置 PAY_MODE 为 'production' 启用真实支付
 * 4. 确保生产 API 已配置 CORS 允许当前域名
 */
(function() {
  // 自动检测 API_BASE
  let apiBase = 'http://127.0.0.1:8787';
  if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
    // 如果页面通过 http(s) 访问，默认使用同源 API
    apiBase = window.location.origin;
  }
  
  window.XH_CONFIG = window.XH_CONFIG || {
    // API 基址（开发：本机；生产：HTTPS API）
    API_BASE: apiBase,
    // API_BASE: 'https://your-api.render.com', // 生产环境可手动指定
    
    // 短信模式：demo（允许888888）、production（仅真实验证码）
    SMS_MODE: 'demo',
    
    // 支付模式：demo（允许mock）、production（仅真实支付）
    PAY_MODE: 'demo',
    
    // 允许演示验证码（仅在 SMS_MODE=demo 时生效）
    ALLOW_DEMO_SMS: true
  };
})();
