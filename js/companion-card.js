/**
 * 星火学伴 · 学伴卡模版（唯一）
 * 家长端选择/随便看看，以及导师入库 updateLiveCard，都渲染这一份。
 * 「学历认证学伴」只是身份类型，不是核验章。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.XinghuoCompanionCard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ROLE_TYPE = '学历认证学伴';
  var ESCROW_STAMP = '资金托管';
  var PENDING_STAMP = '实名待审';
  var PASSED_STAMP = '已通过';
  var UNAUDITED_STAMP = '未审核';

  var COMPOUND_SURNAMES = ['欧阳', '诸葛', '司马', '上官', '皇甫', '令狐', '慕容', '宇文', '长孙', '端木', '司徒', '司空'];

  var STYLE_KEYS = {
    '引导启发': ['引导启发', '启发'],
    '拆题耐心': ['拆题', '错题', '漏洞', '重构'],
    '跟读带练': ['跟读', '带练', '陪读', '督学'],
    '应试提分': ['应试', '提分', '压轴', '模型']
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stripHonorific(raw) {
    return String(raw || '').trim().replace(/(老师|同学)+$/, '');
  }

  function maskName(rawName) {
    var name = stripHonorific(rawName);
    if (!name) return '学伴';
    var i;
    for (i = 0; i < COMPOUND_SURNAMES.length; i++) {
      if (name.indexOf(COMPOUND_SURNAMES[i]) === 0) return COMPOUND_SURNAMES[i] + '同学';
    }
    return name.charAt(0) + '同学';
  }

  function displayName(mentor, override) {
    if (override) return maskName(override);
    if (!mentor) return '学伴';
    var preset = String(mentor.maskedName || '').trim();
    if (/^[\u4e00-\u9fa5A-Za-z]{1,2}同学$/.test(preset)) return preset;
    var real = String(mentor.realName || '').trim();
    return maskName(real || preset);
  }

  function initialFromName(name) {
    var text = stripHonorific(name);
    return text ? text.charAt(0) : '学';
  }

  function isDisplayOnly(mentor) {
    if (!mentor) return false;
    if (mentor.displayOnly || mentor.virtual) return true;
    var status = String(mentor.status || '');
    return status === 'unaudited' || status === UNAUDITED_STAMP;
  }

  function verifyStamp(mentor) {
    if (isDisplayOnly(mentor)) return { label: UNAUDITED_STAMP, tone: 'warn' };
    var status = String((mentor && mentor.status) || '');
    var chsi = String((mentor && mentor.chsiStatus) || '');
    if (status === 'approved' || /^有效/.test(chsi)) {
      return { label: PASSED_STAMP, tone: 'ok' };
    }
    return { label: PENDING_STAMP, tone: 'warn' };
  }

  function schoolLine(mentor) {
    var uni = String((mentor && (mentor.university || mentor.manualUniversity)) || '').split(/[·/]/)[0].trim();
    var major = String((mentor && mentor.major) || '').trim();
    if (/在读|已通过|已核验|已认证|5\.0/.test(major)) major = '';
    if (uni && major) return uni + ' · ' + major;
    var subjects = []
      .concat((mentor && mentor.subjects) || [], (mentor && mentor.customSubjects) || [])
      .map(function (s) { return String(s || '').trim(); })
      .filter(Boolean);
    var subject = subjects[0] || '';
    if (uni && subject) return uni + ' · ' + subject;
    return uni || major || subject || '院校待完善';
  }

  function highlightText(mentor) {
    return String((mentor && (mentor.scoreHighlight || mentor.highlight)) || '').trim();
  }

  function normalizeDisplayRoster(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (item) {
      var copy = {};
      var key;
      var source = item || {};
      for (key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) copy[key] = source[key];
      }
      copy.displayOnly = true;
      copy.virtual = true;
      copy.status = 'unaudited';
      delete copy.chsiStatus;
      delete copy.rating;
      delete copy.score;
      return copy;
    });
  }

  function priceParts(mentor) {
    var rate = Number(mentor && mentor.hourlyRate);
    if (!rate || rate < 0) return { amount: '课酬面议', unit: '' };
    return { amount: '¥' + Math.round(rate), unit: '/时' };
  }

  function styleList(mentor) {
    return []
      .concat((mentor && mentor.styles) || [])
      .map(function (s) { return String(s || '').trim(); })
      .filter(Boolean);
  }

  function subjectList(mentor) {
    return []
      .concat((mentor && mentor.subjects) || [], (mentor && mentor.customSubjects) || [])
      .map(function (s) { return String(s || '').trim(); })
      .filter(Boolean);
  }

  function buildModel(mentor, overrides) {
    var extra = overrides || {};
    var name = extra.name ? maskName(extra.name) : displayName(mentor);
    var verify = extra.verify || verifyStamp(mentor);
    var price = extra.price || priceParts(mentor);
    return {
      id: (mentor && mentor.id) || '',
      name: name,
      initial: extra.initial || initialFromName(name),
      schoolLine: extra.schoolLine || schoolLine(mentor),
      subjects: extra.subjects || subjectList(mentor),
      styles: extra.styles || styleList(mentor),
      priceAmount: price.amount,
      priceUnit: price.unit,
      verifyLabel: verify.label,
      verifyTone: verify.tone,
      roleType: ROLE_TYPE,
      escrowLabel: ESCROW_STAMP,
      highlight: extra.highlight != null ? String(extra.highlight).trim() : highlightText(mentor)
    };
  }

  function tagsHtml(model, variant) {
    var styles = model.styles || [];
    var subjects = model.subjects || [];
    var tags = [];
    if (variant === 'teaser') {
      if (styles[0]) tags.push(styles[0]);
    } else {
      subjects.slice(0, 3).forEach(function (s) { tags.push(s); });
      styles.slice(0, 3).forEach(function (s) { tags.push(s); });
    }
    if (!tags.length) return '';
    return (
      '<div class="xh-ccard-tags">' +
      tags.map(function (tag) {
        return '<span class="xh-ccard-tag">' + esc(tag) + '</span>';
      }).join('') +
      '</div>'
    );
  }

  function render(model, options) {
    var opts = options || {};
    var variant = opts.variant || 'feature';
    var cls = 'xh-ccard xh-ccard-' + variant + (opts.className ? ' ' + opts.className : '');
    var showTopStamps = variant === 'feature' || variant === 'live';
    var showBodyStamps = variant === 'row';
    var showPrice = variant === 'feature' || variant === 'live' || variant === 'row';
    var stamps =
      '<div class="xh-ccard-stamps">' +
        '<span class="xh-ccard-stamp ' + (model.verifyTone === 'ok' ? 'ok' : 'warn') + '" data-stamp="verify">' + esc(model.verifyLabel) + '</span>' +
        '<span class="xh-ccard-stamp ok" data-stamp="escrow">' + esc(model.escrowLabel) + '</span>' +
      '</div>';
    var price = showPrice
      ? '<div class="xh-ccard-price">' + esc(model.priceAmount) +
        (model.priceUnit ? '<span>' + esc(model.priceUnit) + '</span>' : '') +
        '</div>'
      : '';
    var highlight = model.highlight
      ? '<p class="xh-ccard-highlight">' + esc(model.highlight) + '</p>'
      : '';
    var avaInTop = variant !== 'teaser';
    var ava = '<div class="xh-ccard-ava" aria-hidden="true">' + esc(model.initial) + '</div>';
    return (
      '<article class="' + cls + '" data-mentor-id="' + esc(model.id) + '">' +
        (avaInTop
          ? '<div class="xh-ccard-top">' + ava + (showTopStamps ? stamps : '') + '</div>'
          : ava) +
        '<div class="xh-ccard-body">' +
          '<h2 class="xh-ccard-name">' + esc(model.name) + '</h2>' +
          '<p class="xh-ccard-role" data-role-type="' + esc(ROLE_TYPE) + '">' + esc(model.roleType) + '</p>' +
          '<p class="xh-ccard-school">' + esc(model.schoolLine) + '</p>' +
          (showBodyStamps ? stamps : '') +
          tagsHtml(model, variant) +
          highlight +
          price +
        '</div>' +
        (opts.footerHtml || '') +
      '</article>'
    );
  }

  function gradeBand(grade) {
    var g = String(grade || '');
    if (!g) return '';
    if (/小学|小[一二三四五六]|[一二三四五六]年级/.test(g)) return '小学';
    if (/初|中考/.test(g)) return '初中';
    if (/高|高考/.test(g)) return '高中';
    if (/考研/.test(g)) return '考研';
    if (/艺体|美术|音乐|体育|舞蹈/.test(g)) return '艺体';
    return g;
  }

  function mentorGradeBands(mentor) {
    var subjects = subjectList(mentor);
    var bands = {};
    subjects.forEach(function (s) {
      if (/小学/.test(s)) bands['小学'] = true;
      if (/初中|中考体考/.test(s)) bands['初中'] = true;
      if (/高中|艺考文化课/.test(s)) bands['高中'] = true;
      if (/考研/.test(s)) bands['考研'] = true;
      if (/美术|音乐|体育|舞蹈|艺考|体考|艺体/.test(s)) bands['艺体'] = true;
    });
    var list = Object.keys(bands);
    if (!list.length) list.push('初中');
    return list;
  }

  function mentorMatchesGrade(mentor, grade) {
    if (!grade) return true;
    var band = gradeBand(grade);
    return mentorGradeBands(mentor).indexOf(band) >= 0;
  }

  function mentorMatchesSubject(mentor, subject) {
    if (!subject) return true;
    var key = String(subject);
    return subjectList(mentor).some(function (s) {
      if (s === key) return true;
      if (s.indexOf(key) >= 0 || key.indexOf(s) >= 0) return true;
      return false;
    });
  }

  function mentorMatchesStyle(mentor, style) {
    if (!style) return true;
    var keys = STYLE_KEYS[style] || [style];
    var styles = styleList(mentor);
    if (!styles.length) return false;
    return styles.some(function (s) {
      return keys.some(function (k) { return s.indexOf(k) >= 0; });
    });
  }

  function filterCompanions(mentors, criteria) {
    var all = Array.isArray(mentors) ? mentors.slice() : [];
    var opts = criteria || {};
    if (opts.casual) {
      return { exactMatch: true, list: all, mode: all.length ? 'casual' : 'casual-empty' };
    }
    var exact = all.filter(function (m) {
      return mentorMatchesGrade(m, opts.grade) &&
        mentorMatchesSubject(m, opts.subject) &&
        mentorMatchesStyle(m, opts.style);
    });
    if (exact.length) return { exactMatch: true, list: exact, mode: 'exact' };
    if (!all.length) return { exactMatch: false, list: [], mode: 'empty' };
    return { exactMatch: false, list: all, mode: 'recommend' };
  }

  function matchCopy(mode, criteria) {
    var opts = criteria || {};
    var g = esc(opts.grade || '');
    var s = esc(opts.subject || '');
    var st = esc(opts.style || '');
    var joined = [g, s, st].filter(Boolean).join(' · ');
    if (mode === 'casual') {
      return {
        kicker: '随便看看',
        title: '先随便看看这些学伴',
        summaryHtml: '这些卡片只供浏览，状态都是未审核。'
      };
    }
    if (mode === 'casual-empty') {
      return {
        kicker: '随便看看',
        title: '暂时没有可展示的学伴',
        summaryHtml: '你可以改为按年级、科目和风格来匹配。'
      };
    }
    if (mode === 'exact') {
      var parts = [];
      if (g) parts.push('<b>' + g + '</b>');
      if (s) parts.push('<b>' + s + '</b>');
      if (st) parts.push('<b>' + st + '</b>');
      return {
        kicker: '按你的选择匹配',
        title: '为你匹配了这些学伴',
        summaryHtml: parts.length ? ('已按 ' + parts.join(' · ') + ' 匹配。') : '为你匹配了这些学伴。'
      };
    }
    if (mode === 'recommend') {
      return {
        kicker: '推荐其他',
        title: '没有完全匹配，为你推荐其他学伴',
        summaryHtml: '按 <b>' + joined + '</b> 没有找到完全符合的学伴，下面是其他可以选的人。'
      };
    }
    return {
      kicker: '没有完全匹配',
      title: '暂时没有可展示的学伴',
      summaryHtml: joined
        ? '按 <b>' + joined + '</b> 没有找到完全符合的学伴。'
        : '暂时没有可展示的学伴。'
    };
  }

  return {
    ROLE_TYPE: ROLE_TYPE,
    ESCROW_STAMP: ESCROW_STAMP,
    PENDING_STAMP: PENDING_STAMP,
    PASSED_STAMP: PASSED_STAMP,
    UNAUDITED_STAMP: UNAUDITED_STAMP,
    STYLE_KEYS: STYLE_KEYS,
    esc: esc,
    maskName: maskName,
    displayName: displayName,
    isDisplayOnly: isDisplayOnly,
    verifyStamp: verifyStamp,
    normalizeDisplayRoster: normalizeDisplayRoster,
    schoolLine: schoolLine,
    priceParts: priceParts,
    buildModel: buildModel,
    render: render,
    gradeBand: gradeBand,
    mentorMatchesGrade: mentorMatchesGrade,
    mentorMatchesSubject: mentorMatchesSubject,
    mentorMatchesStyle: mentorMatchesStyle,
    filterCompanions: filterCompanions,
    matchCopy: matchCopy
  };
});
