/**
 * 统一 Toast（禁止 alert）
 */
function showToast(message, type) {
  const t = type || 'success';
  let icon = 'none';
  if (t === 'success') icon = 'success';
  else if (t === 'error') icon = 'error';
  wx.showToast({
    title: String(message || '').slice(0, 40),
    icon: icon === 'none' ? 'none' : icon,
    duration: t === 'error' || t === 'warning' ? 2600 : 2000,
    mask: false
  });
}

module.exports = { showToast };
