/**
 * 星火学伴 · 微信小程序配置
 *
 * 生产 API（ICP 备案后）：https://www.sparkles.com.cn
 * 本地联调：可临时改 API_BASE 为电脑局域网 IP（如 http://192.168.1.8:8787），
 * 并在「详情 → 本地设置」勾选「不校验合法域名」。
 *
 * 小程序管理后台需配置 request 合法域名：https://www.sparkles.com.cn
 */
module.exports = {
  API_BASE: 'https://www.sparkles.com.cn',

  // 支付模式
  PAY_MODE: 'demo', // demo 或 production

  // 短信模式
  SMS_MODE: 'demo', // demo（允许888888）或 production

  // 智能仓 / IoT 门禁（暂缓上线时保持 false）
  FEATURE_SMART_WAREHOUSE: false
};
