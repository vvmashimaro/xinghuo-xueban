/**
 * Client feature flags (read from window.XH_CONFIG after js/config.js).
 */
(function () {
  function isSmartWarehouseEnabled() {
    return !!(window.XH_CONFIG && window.XH_CONFIG.FEATURE_SMART_WAREHOUSE);
  }

  function neutralizeBookingSpaceSelect() {
    const label = document.querySelector('[data-booking-space-label]');
    if (label) {
      label.textContent = '3. 线下上课网点';
    }
    const sel = document.getElementById('bookingSpaceSelect');
    if (!sel) return;
    const neutral = {
      '青羊金沙文化微网点': '青羊金沙文化微网点（地铁4号线金沙博物馆站附近）',
      '高新大源中央微网点': '高新大源中央微网点（天府二街大源片区）',
      '武侯川大望江微网点': '武侯川大望江微网点（川大望江校区附近）'
    };
    Array.from(sel.options).forEach((opt) => {
      if (neutral[opt.value]) opt.text = neutral[opt.value];
    });
  }

  function applySmartWarehouseGating() {
    if (isSmartWarehouseEnabled()) return;

    document.querySelectorAll('[data-warehouse-only]').forEach((el) => {
      el.classList.add('hidden');
    });
    document.querySelectorAll('[data-warehouse-off]').forEach((el) => {
      el.classList.remove('hidden');
    });

    const simple = document.getElementById('bookingSuccessSimple');
    const warehouse = document.getElementById('bookingSuccessWarehouse');
    if (simple) simple.classList.remove('hidden');
    if (warehouse) warehouse.classList.add('hidden');

    neutralizeBookingSpaceSelect();

    document.querySelectorAll('[data-contract-iot-clause]').forEach((el) => {
      el.classList.add('hidden');
    });
    document.querySelectorAll('[data-contract-warehouse-clause]').forEach((el) => {
      el.classList.add('hidden');
    });
  }

  function getLoginRoleSubtitle(role) {
    if (role === 'mentor') {
      return isSmartWarehouseEnabled()
        ? '银行合约直达秒结 · 免押扫码开启智能教学仓'
        : '银行合约直达秒结 · 阳光透明接单授课';
    }
    return isSmartWarehouseEnabled()
      ? '单次约课零预付 · 优选双一流学霸与合规微空间'
      : '单次约课零预付 · 优选双一流学霸导师';
  }

  window.isSmartWarehouseEnabled = isSmartWarehouseEnabled;
  window.applySmartWarehouseGating = applySmartWarehouseGating;
  window.getLoginRoleSubtitle = getLoginRoleSubtitle;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySmartWarehouseGating);
  } else {
    applySmartWarehouseGating();
  }
})();
