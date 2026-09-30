/**
 * 星火运营中台 · API 封装（Bearer 会话）
 */
(function (global) {
  'use strict';

  function baseUrl() {
    return (global.XH_CONFIG && global.XH_CONFIG.API_BASE) || 'http://127.0.0.1:8787';
  }

  function token() {
    try {
      return localStorage.getItem('xh_auth_token_v1') || '';
    } catch (e) {
      return '';
    }
  }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    const opts = { method, headers };
    if (body !== undefined && method !== 'GET') {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(baseUrl() + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText || '请求失败');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  global.AdminApi = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    listPayOrders: (query) => {
      const qs = new URLSearchParams(query || {}).toString();
      return request('GET', '/api/pay/orders' + (qs ? '?' + qs : ''));
    },
    refundOrder: (outTradeNo, reason) =>
      request('POST', '/api/pay/orders/' + encodeURIComponent(outTradeNo) + '/refund', { reason }),
    getFeatureFlags: () => request('GET', '/api/admin/feature-flags'),
    patchFeatureFlags: (patch) => request('PATCH', '/api/admin/feature-flags', patch),
    listFeedback: () => request('GET', '/api/feedback'),
    patchFeedback: (id, patch) => request('PATCH', '/api/feedback/' + encodeURIComponent(id), patch),
    processEscrow: () => request('POST', '/api/bookings/process-escrow', {})
  };
})(typeof window !== 'undefined' ? window : globalThis);
