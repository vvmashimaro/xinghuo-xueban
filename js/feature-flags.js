/**
 * Client feature flags (read from window.XH_CONFIG after js/config.js).
 * Static HTML defaults to flag-OFF (warehouse copy hidden); when the flag is on we reveal it.
 */
(function () {
  function isSmartWarehouseEnabled() {
    return !!(window.XH_CONFIG && window.XH_CONFIG.FEATURE_SMART_WAREHOUSE);
  }

  const WAREHOUSE_BOOKING_SPACE_LABEL =
    '3. 专属智能隔音自习仓网点（免进陌生家庭隐患）';
  const NEUTRAL_BOOKING_SPACE_LABEL = '3. 线下上课网点';

  const WAREHOUSE_BOOKING_SPACE_OPTIONS = {
    '青羊金沙文化微网点':
      '青羊金沙文化微网点 (4号线金沙博物馆站旁 · 01号独立隔音双人仓)',
    '高新大源中央微网点':
      '高新大源中央微网点 (天府二街大源核心生活圈 · 03号讨论仓)',
    '武侯川大望江微网点':
      '武侯川大望江微网点 (一环路南一段川大旁 · 02号智能互联仓)'
  };

  function setBookingSpaceSelectCopy(optionMap, labelText) {
    const label = document.querySelector('[data-booking-space-label]');
    if (label && labelText) {
      label.textContent = labelText;
    }
    const sel = document.getElementById('bookingSpaceSelect');
    if (!sel) return;
    Array.from(sel.options).forEach((opt) => {
      if (optionMap[opt.value]) opt.text = optionMap[opt.value];
    });
  }

  function restoreWarehouseBookingSpaceSelect() {
    setBookingSpaceSelectCopy(
      WAREHOUSE_BOOKING_SPACE_OPTIONS,
      WAREHOUSE_BOOKING_SPACE_LABEL
    );
  }

  function applySmartWarehouseGating() {
    if (!isSmartWarehouseEnabled()) return;

    document.querySelectorAll('[data-warehouse-only]').forEach((el) => {
      el.classList.remove('hidden');
    });
    document.querySelectorAll('[data-warehouse-off]').forEach((el) => {
      el.classList.add('hidden');
    });

    const simple = document.getElementById('bookingSuccessSimple');
    const warehouse = document.getElementById('bookingSuccessWarehouse');
    if (simple) simple.classList.add('hidden');
    if (warehouse) warehouse.classList.remove('hidden');

    restoreWarehouseBookingSpaceSelect();

    document.querySelectorAll('[data-contract-iot-clause]').forEach((el) => {
      el.classList.remove('hidden');
    });
    document.querySelectorAll('[data-contract-warehouse-clause]').forEach((el) => {
      el.classList.remove('hidden');
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
