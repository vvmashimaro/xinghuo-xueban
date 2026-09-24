# WeChat Mini-Program UI Bug Fixes

## Overview
This document summarizes UI bug fixes applied to the 星火学伴 WeChat mini-program to resolve interface display, checkbox tap detection, and picker dropdown visibility issues.

## Issues Fixed (2026-09-24)

### 1. Incomplete Interface Display
**Symptom**: Layout clipped, content cut off, pages not fully visible on some device sizes.

**Root Cause**: Page element lacked explicit height and overflow configuration.

**Fix**: Added `height: 100%; overflow-y: auto;` to `page` element in `app.wxss`.

**Affected Pages**: All pages (global fix).

### 2. Checkboxes Cannot Be Checked
**Symptom**: Tapping privacy consent, service agreement, and other checkboxes did nothing or had inconsistent response.

**Root Cause**: 
- Checkbox hit target was only 40rpx × 40rpx (too small for reliable touch input)
- Missing expanded tap area
- Insufficient padding on interactive rows

**Fix**: 
- Increased `.check-box` from 40rpx to **48rpx**
- Added expanded hit area via `::after` pseudo-element (-8rpx outset on all sides)
- Added `min-height: 56rpx` and `padding: 8rpx` to `.check-row`

**Affected Pages**:
- `parent-register` (privacy consent, service agreement)
- `parent-dashboard` (phone auth modal privacy consent)
- `login` (service agreement)
- `mentor-onboard` (compliance checkboxes, privacy authorization)

### 3. Dropdown/Picker Menus Cannot Display
**Symptom**: Native WeChat picker dropdowns were invisible or clipped after opening.

**Root Cause**:
- Modal panels used `overflow: hidden` which clipped dropdown panels
- Missing z-index stacking context on picker elements
- Parent containers inadvertently clipped dropdown UI extending beyond boundaries

**Fix**:
- Changed `.modal-panel` from `overflow: hidden` to `overflow: visible`
- Added explicit `z-index: 1001` to `.modal-panel`
- Added `position: relative; z-index: 10;` to all `picker` elements
- Set modal-head and modal-foot to `flex-shrink: 0`

**Affected Components**:
- Grade/district/space pickers (`parent-register`)
- Bank picker (`mentor-onboard`)
- Sort picker (`parent-dashboard`)
- Teaching space picker (`mentor-dashboard`, `admin-audit`)

## Files Modified

| File | Changes |
|------|---------|
| `_platform/miniprogram/app.wxss` | Page height/overflow, checkbox sizing, modal overflow/z-index, picker z-index |
| `_platform/miniprogram/pages/parent-register/parent-register.wxss` | Chip-wrap z-index, pace-row min-height |
| `_platform/miniprogram/pages/parent-dashboard/parent-dashboard.wxss` | Sort picker z-index, pace-row styling |
| `_platform/miniprogram/pages/mentor-onboard/mentor-onboard.wxss` | Chip-wrap z-index |
| `_platform/miniprogram/pages/admin-audit/admin-audit.wxss` | Picker z-index |
| `_platform/miniprogram/pages/mentor-dashboard/mentor-dashboard.wxss` | Picker z-index |

## Regression Test Checklist

When making future UI changes, verify:

- [ ] **Checkboxes**: All privacy consent and agreement checkboxes toggle reliably on tap
  - Parent registration privacy consent
  - Parent registration service agreement  
  - Login service agreement
  - Mentor onboard compliance checkboxes
  - Parent dashboard phone auth modal privacy consent

- [ ] **Pickers**: All dropdown menus open and allow selection
  - Grade/district/space pickers (parent-register)
  - Bank picker (mentor-onboard)  
  - Sort picker (parent-dashboard)
  - Teaching space picker (mentor-dashboard, booking modal, admin-audit)

- [ ] **Radio Groups**: Pace selection and hour selection work in wizard modals
  - Parent-register wizard pace selection (3-step modal)
  - Parent-dashboard booking modal hour selection

- [ ] **Page Scrolling**: All content is visible and scrollable
  - Parent-register: scroll to bottom button visible
  - Parent-dashboard: all tutor cards visible
  - Long pages don't clip content

- [ ] **Phone Compliance**: No regressions to phone authorization flows
  - Privacy policy must be read before phone auth
  - getPhoneNumber triggered only by explicit user tap
  - SMS fallback remains functional
  - Masked phone display correct

## Component Patterns

### Custom Checkbox Pattern (Currently Used)
```xml
<view class="check-row" bindtap="onToggleCheckbox">
  <view class="check-box {{isChecked?'on':''}}">{{isChecked?'✓':''}}</view>
  <text>Checkbox label text</text>
</view>
```

**Styling requirements**:
- `.check-box`: min 48rpx × 48rpx for touch targets
- `.check-row`: padding and min-height for tap area
- Use `bindtap` (not `catchtap`) on check-row unless nested clickables

### Native Picker Pattern
```xml
<picker mode="selector" range="{{options}}" value="{{selectedIndex}}" bindchange="onChange">
  <view class="input">{{options[selectedIndex]}}</view>
</picker>
```

**Styling requirements**:
- Picker element needs `position: relative; z-index: 10;`
- Parent containers must not use `overflow: hidden`
- Modal panels should use `overflow: visible`

## Known Limitations

1. **Custom Dropdown Workaround**: WeChat mini-program does not support HTML `<select>` or custom CSS dropdowns that float over content. Only native `<picker>` components work reliably. If complex filtering UI is needed, use modal panels instead of dropdown overlays.

2. **Checkbox vs Native checkbox-group**: The project currently uses custom checkbox styling (styled `<view>` elements) rather than WeChat's native `<checkbox>` component. This is intentional for design consistency but requires larger hit targets and careful tap handling.

3. **Z-Index Stacking**: WeChat DevTools uses a different rendering engine than production mini-program runtime. Always test picker/dropdown behavior on real device or simulator, not just DevTools preview.

## References

- [WeChat Mini-Program Picker Component Docs](https://developers.weixin.qq.com/miniprogram/dev/component/picker.html)
- [WeChat Mini-Program Form Component Docs](https://developers.weixin.qq.com/miniprogram/dev/component/checkbox-group.html)
- Phone compliance documentation: See `MINIPROGRAM_PHONE.md`

---

**Last Updated**: 2026-09-24  
**PR**: [#4](https://github.com/vvmashimaro/xinghuo-xueban/pull/4)
