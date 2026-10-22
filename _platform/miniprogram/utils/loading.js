/**
 * 小程序 API 等待层：当前页展示 GIF 星标（微信不保证 SVG 动画）。
 */
let pending = 0;
let showTimer = null;
const DELAY_MS = 160;

function apply(show) {
  try {
    const pages = getCurrentPages();
    const page = pages && pages.length ? pages[pages.length - 1] : null;
    if (!page || typeof page.setData !== 'function') return;
    if (page.data && page.data.xhLoadingShow === show) return;
    page.setData({ xhLoadingShow: show });
  } catch (e) {}
}

function begin() {
  pending += 1;
  if (pending === 1 && !showTimer) {
    showTimer = setTimeout(function () {
      showTimer = null;
      if (pending > 0) apply(true);
    }, DELAY_MS);
  }
}

function end() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    apply(false);
  }
}

function shouldTrack(path) {
  const p = String(path || '');
  if (!p) return false;
  if (p.indexOf('/api/pay/wechat/sync') >= 0) return false;
  if (p.indexOf('/api/feature-flags') >= 0) return false;
  if (p.indexOf('/api/health') >= 0) return false;
  return true;
}

module.exports = {
  begin,
  end,
  shouldTrack
};
