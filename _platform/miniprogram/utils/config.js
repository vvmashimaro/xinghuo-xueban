/**
 * 星火学伴 · 微信小程序配置
 * 
 * 开发环境：
 * - 开发者工具可用 127.0.0.1
 * - 真机调试请改为电脑局域网 IP（如 http://192.168.1.8:8787）
 * - 在「详情 → 本地设置」勾选「不校验合法域名」
 * 
 * 生产环境部署步骤：
 * 1. 将 API_BASE 改为生产 API 地址（必须 HTTPS）
 * 2. 在小程序管理后台配置「服务器域名」request 合法域名
 * 3. 配置「业务域名」（如需 web-view）
 * 4. 提交代码审核前确保后端已部署并可访问
 * 
 * 示例生产配置：
 * API_BASE: 'https://your-api.render.com'
 * API_BASE: 'https://api.xinghuo-xueban.com'
 */
module.exports = {
  // 开发环境
  API_BASE: 'http://127.0.0.1:8787',
  
  // 生产环境（部署时取消注释并填入真实地址）
  // API_BASE: 'https://your-api-domain.com',
  
  // 支付模式
  PAY_MODE: 'demo', // demo 或 production
  
  // 短信模式
  SMS_MODE: 'demo' // demo（允许888888）或 production
};
