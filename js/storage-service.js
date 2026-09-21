/**
 * 星火学伴 · 统一存储服务（网页）
 * 本地 localStorage 作缓存；读写同步到统一库 API (默认 http://127.0.0.1:8787)
 */
(function (global) {
  'use strict';

  const API_BASE =
    (global.XH_CONFIG && global.XH_CONFIG.API_BASE) ||
    'http://127.0.0.1:8787';

  const KEYS = {
    mentors: 'xh_mentors_v1',
    parents: 'xh_parents_v1',
    bookings: 'xh_bookings_v1',
    session: 'xh_session_v1',
    contracts: 'xh_contracts_v1',
    assessments: 'xh_assessments_v1',
    seeded: 'xh_seeded_v1'
  };

  const ASSESSMENT_SUBJECTS = ['数学', '英语', '物理', '化学'];
  const GRADE_BANDS = ['小学', '初中', '高中'];

  function normalizeAssessmentSubject(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    for (let i = 0; i < ASSESSMENT_SUBJECTS.length; i++) {
      const b = ASSESSMENT_SUBJECTS[i];
      if (s === b || s.indexOf(b) >= 0) return b;
    }
    return s;
  }

  /** 从注册年级字符串推导学段：小学 / 初中 / 高中 */
  function gradeBandFromGrade(gradeStr) {
    const g = String(gradeStr || '').trim();
    if (!g) return '初中';
    // 高中优先（含艺考文化课等）
    if (/高[一二三]|高中|艺考/.test(g)) return '高中';
    // 初中：初一–初三 / 七年级–九年级 / 中考
    if (/初[一二三]|[七八九]年级|初中|中考/.test(g)) return '初中';
    // 小学：一年级…六年级 / 小一…小六 / 小四及以下
    if (/小[一二三四五六]|[一二三四五六]年级|小学|小四及以下|小升初/.test(g)) return '小学';
    // 竞赛自招等含「初高中」时默认按初中题库，避免过难
    if (/竞赛|自招|强基/.test(g)) return '高中';
    return '初中';
  }

  /** 展示用短年级名，如「初三 (中考冲刺)」→「初三」 */
  function shortGradeLabel(gradeStr) {
    const g = String(gradeStr || '').trim();
    if (!g) return '学员';
    const m = g.match(/小四及以下|小[一二三四五六]|初[一二三]|高[一二三]|[一二三四五六七八九]年级/);
    if (m) return m[0];
    return g.split(/[\s(（]/)[0] || g;
  }

  /** 学员已选学科 → 测评 tabs；空则回退全部 */
  function resolveAssessmentSubjectsForParent(parent) {
    const enrolled = (parent && Array.isArray(parent.subjects)) ? parent.subjects : [];
    const out = [];
    enrolled.forEach(function (s) {
      const n = normalizeAssessmentSubject(s);
      if (n && ASSESSMENT_SUBJECTS.indexOf(n) >= 0 && out.indexOf(n) < 0) out.push(n);
    });
    return out.length ? out : ASSESSMENT_SUBJECTS.slice();
  }

  function scoreToLevel(score) {
    const n = Number(score) || 0;
    if (n >= 85) return '优秀';
    if (n >= 70) return '良好';
    if (n >= 50) return '基础';
    return '待提升';
  }

  function resolveParentKey(parentIdOrPhone) {
    const key = String(parentIdOrPhone || '').trim();
    if (!key) return { id: '', phone: '' };
    const parents = _read(KEYS.parents, []) || [];
    const parent = parents.find((p) => p.id === key || String(p.phone || '') === key) || null;
    return {
      id: parent ? parent.id : key,
      phone: parent ? String(parent.phone || '') : (/^1\d{10}$/.test(key) ? key : '')
    };
  }

  let _readyResolve;
  const _readyPromise = new Promise((resolve) => {
    _readyResolve = resolve;
  });
  let _hydrated = false;
  let _serverDownToastShown = false;

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null || raw === '') return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[StorageService] read fail', key, e);
      return fallback;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[StorageService] write fail', key, e);
      return false;
    }
  }

  function _now() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function _uid(prefix) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  const DEFAULT_SLOTS = [
    '周六 09:00-11:00',
    '周六 14:00-16:00',
    '周日 09:00-11:00',
    '周日 19:00-21:00',
    '周三 19:00-21:00'
  ];

  const SPACE_OPTIONS = [
    '青羊金沙文化微网点',
    '高新大源中央微网点',
    '武侯川大望江微网点'
  ];

  function _availabilityToSlotLabels(availability) {
    const labels = [];
    const wdNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    (availability || []).forEach((item) => {
      const wd = parseInt(item.weekday, 10);
      const name = wdNames[wd] || ('周' + wd);
      (item.ranges || []).forEach((r) => {
        if (r && r.start && r.end) labels.push(name + ' ' + r.start + '-' + r.end);
      });
    });
    return labels;
  }

  function _parseSlotLabelToAvailability(slots) {
    const wdMap = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };
    const byDay = {};
    (slots || []).forEach((raw) => {
      const s = String(raw || '').trim();
      if (!s) return;
      let wd = null;
      let rest = s;
      Object.keys(wdMap).forEach((name) => {
        if (s.indexOf(name) === 0) {
          wd = wdMap[name];
          rest = s.slice(name.length).trim();
        }
      });
      if (wd == null) return;
      const m = rest.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (!m) return;
      if (!byDay[wd]) byDay[wd] = [];
      byDay[wd].push({ start: m[1].padStart(5, '0'), end: m[2].padStart(5, '0') });
    });
    return Object.keys(byDay).map((k) => ({
      weekday: parseInt(k, 10),
      ranges: byDay[k]
    }));
  }

  function _withMentorDefaults(m) {
    const copy = Object.assign({}, m);
    if (!Array.isArray(copy.availability)) copy.availability = [];
    if ((!copy.availableSlots || !copy.availableSlots.length) && copy.availability.length) {
      copy.availableSlots = _availabilityToSlotLabels(copy.availability);
    }
    if (copy.availableSlots == null) {
      copy.availableSlots = DEFAULT_SLOTS.slice();
    }
    if ((!copy.availability || !copy.availability.length) && copy.availableSlots && copy.availableSlots.length) {
      copy.availability = _parseSlotLabelToAvailability(copy.availableSlots);
    }
    if (!copy.preferredSpaces) {
      copy.preferredSpaces = copy.spacePreference
        ? [copy.spacePreference]
        : [SPACE_OPTIONS[0]];
    }
    if (copy.bankName == null) copy.bankName = '招商银行';
    if (copy.bankCardNumber == null) copy.bankCardNumber = '';
    if (copy.sensitiveChangePending == null) copy.sensitiveChangePending = false;
    return copy;
  }

  function getSeedBookings() {
    return [
      {
        id: 'BK-SEED-001', mentorId: 'AP-8802', tutorId: 'AP-8802', tutorName: '李老师',
        parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
        studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中物理',
        space: '高新大源中央微网点', schedule: '2026-09-20 周六 14:00-16:00',
        timeSlot: '周六 14:00-16:00', amount: 220, hours: 2, status: 'pending_accept',
        type: 'one_off', sessions: [], escrowStatus: 'frozen',
        createdAt: '2026-09-14 16:20', declineReason: ''
      },
      {
        id: 'BK-SEED-002', mentorId: 'AP-8802', tutorId: 'AP-8802', tutorName: '李老师',
        parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
        studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中数学',
        space: '高新大源中央微网点', schedule: '2026-09-21 周日 09:00-11:00',
        timeSlot: '周日 09:00-11:00', amount: 220, hours: 2, status: 'pending_accept',
        type: 'one_off', sessions: [], escrowStatus: 'frozen',
        createdAt: '2026-09-14 18:05', declineReason: ''
      },
      {
        id: 'BK-SEED-003', mentorId: 'AP-8803', tutorId: 'AP-8803', tutorName: '王老师',
        parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
        studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中英语',
        space: '青羊金沙文化微网点', schedule: '2026-09-22 周一 19:00-21:00',
        timeSlot: '周一 19:00-21:00', amount: 240, hours: 2, status: 'pending_accept',
        type: 'one_off', sessions: [], escrowStatus: 'frozen',
        createdAt: '2026-09-14 20:40', declineReason: ''
      },
      /* —— 已完课演示：单次 · 已划拨 + 有小结 —— */
      {
        id: 'BK-SEED-004', mentorId: 'AP-8802', tutorId: 'AP-8802', tutorName: '李老师',
        parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
        studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中物理',
        space: '高新大源中央微网点', schedule: '2026-09-06 周六 14:00-16:00',
        timeSlot: '周六 14:00-16:00', amount: 220, hours: 2, status: 'accepted',
        type: 'one_off', escrowStatus: 'released',
        completedAt: '2026-09-06 16:08',
        createdAt: '2026-09-04 10:15', declineReason: '',
        sessions: [{
          id: 'SES-SEED-004',
          date: '2026-09-06', weekday: 6, weekdayLabel: '周六',
          timeStart: '14:00', timeEnd: '16:00', timeLabel: '14:00-16:00',
          status: 'completed', escrowStatus: 'released',
          leaveRequestedAt: '', leaveConfirmedAt: '', leaveRequestedBy: '',
          leaveDeadline: '2026-09-05 23:59',
          completedAt: '2026-09-06 16:08', completedBy: 'mentor',
          releaseAt: '2026-09-08 16:08',
          classSummary: {
            title: '力学受力分析专题',
            content: '本课梳理重力/弹力/摩擦力三力合成，完成课本例题 3 道。作业：错题本 P12-15。下次建议带上单元卷复盘。',
            tags: ['掌握情况', '作业', '下次建议'],
            createdAt: '2026-09-06 16:12',
            mentorId: 'AP-8802'
          }
        }]
      },
      /* —— 已完课演示：单次 · 48h观察中 + 有小结 —— */
      {
        id: 'BK-SEED-005', mentorId: 'AP-8802', tutorId: 'AP-8802', tutorName: '李老师',
        parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
        studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中数学',
        space: '高新大源中央微网点', schedule: '2026-09-14 周日 09:00-11:00',
        timeSlot: '周日 09:00-11:00', amount: 220, hours: 2, status: 'accepted',
        type: 'one_off', escrowStatus: 'frozen',
        completedAt: '2026-09-15 20:10',
        createdAt: '2026-09-12 14:30', declineReason: '',
        sessions: [{
          id: 'SES-SEED-005',
          date: '2026-09-14', weekday: 0, weekdayLabel: '周日',
          timeStart: '09:00', timeEnd: '11:00', timeLabel: '09:00-11:00',
          status: 'completed', escrowStatus: 'frozen',
          leaveRequestedAt: '', leaveConfirmedAt: '', leaveRequestedBy: '',
          leaveDeadline: '2026-09-13 23:59',
          completedAt: '2026-09-15 20:10', completedBy: 'mentor',
          releaseAt: '2026-09-17 20:10',
          classSummary: {
            title: '二次函数最值专题复盘',
            content: '掌握顶点式求最值与对称轴讨论。作业：教材习题 5.3 选做。下次建议巩固动点综合题。',
            tags: ['掌握情况', '作业'],
            createdAt: '2026-09-15 20:15',
            mentorId: 'AP-8802'
          }
        }]
      },
      /* —— 已完课演示：每周固定 · 含已完课 / 观察中 / 待上 —— */
      {
        id: 'BK-SEED-006', mentorId: 'AP-8802', tutorId: 'AP-8802', tutorName: '李老师',
        parentId: 'PAR-DEMO-001', parentName: '刘女士', parentPhone: '13980889211',
        studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', subject: '初中物理',
        space: '高新大源中央微网点', schedule: '每周周六 14:00 · 共4次',
        timeSlot: '周六 14:00-16:00', amount: 880, hours: 2, status: 'accepted',
        type: 'weekly', weekday: 6, time: '14:00', sessionCount: 4,
        escrowStatus: 'frozen',
        createdAt: '2026-08-28 11:00', declineReason: '',
        sessions: [
          {
            id: 'SES-SEED-006-0',
            date: '2026-08-30', weekday: 6, weekdayLabel: '周六',
            timeStart: '14:00', timeEnd: '16:00', timeLabel: '14:00-16:00',
            status: 'completed', escrowStatus: 'released',
            leaveRequestedAt: '', leaveConfirmedAt: '', leaveRequestedBy: '',
            leaveDeadline: '2026-08-29 23:59',
            completedAt: '2026-08-30 16:05', completedBy: 'mentor',
            releaseAt: '2026-09-01 16:05',
            classSummary: {
              title: '电学入门 · 串并联电路',
              content: '厘清电流电压电阻基本关系，完成串并联对比实验题。作业：练习册第 8 课。',
              tags: ['掌握情况', '作业'],
              createdAt: '2026-08-30 16:20',
              mentorId: 'AP-8802'
            }
          },
          {
            id: 'SES-SEED-006-1',
            date: '2026-09-06', weekday: 6, weekdayLabel: '周六',
            timeStart: '14:00', timeEnd: '16:00', timeLabel: '14:00-16:00',
            status: 'completed', escrowStatus: 'released',
            leaveRequestedAt: '', leaveConfirmedAt: '', leaveRequestedBy: '',
            leaveDeadline: '2026-09-05 23:59',
            completedAt: '2026-09-06 16:00', completedBy: 'mentor',
            releaseAt: '2026-09-08 16:00',
            classSummary: {
              title: '动态电路综合计算',
              content: '滑动变阻器变化对功率影响已掌握大半；仍需加强极值讨论。',
              tags: ['掌握情况', '下次建议'],
              createdAt: '2026-09-06 16:18',
              mentorId: 'AP-8802'
            }
          },
          {
            id: 'SES-SEED-006-2',
            date: '2026-09-13', weekday: 6, weekdayLabel: '周六',
            timeStart: '14:00', timeEnd: '16:00', timeLabel: '14:00-16:00',
            status: 'completed', escrowStatus: 'frozen',
            leaveRequestedAt: '', leaveConfirmedAt: '', leaveRequestedBy: '',
            leaveDeadline: '2026-09-12 23:59',
            completedAt: '2026-09-15 19:40', completedBy: 'mentor',
            releaseAt: '2026-09-17 19:40',
            classSummary: null
          },
          {
            id: 'SES-SEED-006-3',
            date: '2026-09-20', weekday: 6, weekdayLabel: '周六',
            timeStart: '14:00', timeEnd: '16:00', timeLabel: '14:00-16:00',
            status: 'scheduled', escrowStatus: 'frozen',
            leaveRequestedAt: '', leaveConfirmedAt: '', leaveRequestedBy: '',
            leaveDeadline: '2026-09-19 23:59',
            completedAt: '', releaseAt: ''
          }
        ]
      }
    ];
  }

  function getSeedMentors() {
    // 精简：完整种子由服务端提供；离线兜底用最小集
    return [
      {
        id: 'AP-8802', code: 'CD-2026-8810', realName: '李思源', phone: '13880123456',
        idCard: '510104200305128910', university: '电子科技大学', province: '四川',
        degree: '本科在读 (大三)', chsiCode: 'B12E8890MN340112', chsiStatus: '有效 (在籍)',
        chsiMajor: '信息与软件工程专业 · 本科 (2027年毕业)', publicTeacherCompliance: true,
        subjects: ['初中物理', '初中数学', '初中全科答疑'], customSubjects: [],
        hourlyRate: 110, rateDifficulty: '容易成交',
        rateTierNote: '符合初中阶段建议区间 (¥100-180/h)',
        scoreHighlight: '高考理综278分 · 物理满分110',
        styles: ['基础漏洞重构', '错题本高效提分法'],
        proofFiles: [], lectureUrl: 'https://pan.quark.cn/s/demoQuarkPhysics882',
        status: 'approved', submitTime: '2026-09-09 19:40',
        evalGrade: 'V1 级标准导师',
        reviewComment: '物理力学受力分析拆解细致，适合初中提优补弱学员。',
        spacePreference: '高新大源中央微网点'
      },
      {
        id: 'AP-8803', code: 'CD-2026-8811', realName: '王艺霖', phone: '15928114422',
        idCard: '510105200409201144', university: '西南交通大学', province: '四川',
        degree: '本科在读 (大二)', chsiCode: 'C33K9911OP231908', chsiStatus: '有效 (在籍)',
        chsiMajor: '外国语学院英语专业 · 英语专业四级优秀', publicTeacherCompliance: true,
        subjects: ['小学英语', '初中英语', '考研英语(一/二)'], customSubjects: ['雅思托福口语备考'],
        hourlyRate: 120, rateDifficulty: '容易成交',
        rateTierNote: '符合初中/考研英语建议区间 (¥100-180/h)',
        scoreHighlight: '高考英语146分 · 全国大学生英语竞赛特等奖',
        styles: ['引导启发解题', '耐心督学陪读'],
        proofFiles: [], lectureUrl: 'https://www.bilibili.com/video/BV1demoEnglishLecture',
        status: 'approved', submitTime: '2026-09-09 20:15',
        evalGrade: 'V2 级金牌导师',
        reviewComment: '发音地道，中考阅读长难句结构归纳能力优秀。',
        spacePreference: '青羊金沙文化微网点'
      }
    ];
  }

  function getSeedParent() {
    return {
      id: 'PAR-DEMO-001', parentName: '刘女士', parentRole: '妈妈', phone: '13980889211',
      studentNickname: '乐乐同学', studentGrade: '初三 (中考冲刺)', cityDistrict: '青羊区',
      subjects: ['数学', '物理'],
      subjectPlans: {
        '数学': {
          weakPoints: ['二次函数图象性质与最值求法', '圆的切线性质与辅助线综合证明'],
          pacing: '查缺补漏 · 阶段单元复盘',
          pains: ['畏难情绪遇压轴就慌', '粗心漏题做题慢']
        },
        '物理': {
          weakPoints: ['动态电路欧姆定律综合计算', '电功率比值与电热极值分析'],
          pacing: '紧贴校内进度 · 随堂查漏补缺',
          pains: ['概念模糊公式乱用']
        }
      },
      syllabusTopics: [
        '二次函数图象性质与最值求法', '圆的切线性质与辅助线综合证明',
        '动态电路欧姆定律综合计算', '电功率比值与电热极值分析'
      ],
      pacingMode: '查缺补漏 · 阶段单元复盘',
      budgetMin: 100, budgetMax: 160, budgetRate: 130,
      selectedSpace: '青羊金沙文化微网点',
      targetGoal: '希望在中考前加强几何综合证明与函数动点题型，每周在青羊金沙仓系统巩固。',
      painTags: ['畏难情绪遇压轴就慌', '粗心漏题做题慢', '概念模糊公式乱用'],
      createdAt: '2026-09-10 09:00', updatedAt: '2026-09-10 09:00'
    };
  }

  function _applySnapshot(snap) {
    if (!snap || typeof snap !== 'object') return;
    if (Array.isArray(snap.mentors)) _write(KEYS.mentors, snap.mentors.map(_withMentorDefaults));
    if (Array.isArray(snap.parents)) _write(KEYS.parents, snap.parents);
    if (Array.isArray(snap.bookings)) _write(KEYS.bookings, snap.bookings);
    if (Array.isArray(snap.contracts)) _write(KEYS.contracts, snap.contracts);
    if (Array.isArray(snap.assessments)) _write(KEYS.assessments, snap.assessments);
    if (snap.session !== undefined) {
      if (snap.session) _write(KEYS.session, snap.session);
    }
    _write(KEYS.seeded, snap.seeded != null ? !!snap.seeded : true);
  }

  function _toastOnce(msg) {
    if (_serverDownToastShown) return;
    _serverDownToastShown = true;
    console.warn('[StorageService]', msg);
    try {
      if (typeof global.showToast === 'function') {
        global.showToast(msg);
      } else if (document && document.body) {
        const el = document.createElement('div');
        el.textContent = msg;
        el.style.cssText =
          'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
          'background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;' +
          'font-size:13px;z-index:99999;opacity:0.95;max-width:90%;text-align:center';
        document.body.appendChild(el);
        setTimeout(() => { try { el.remove(); } catch (e) {} }, 4200);
      }
    } catch (e) {}
  }

  async function _api(method, path, body) {
    const url = API_BASE.replace(/\/$/, '') + path;
    const opts = {
      method: method,
      headers: { Accept: 'application/json' }
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error('API ' + resp.status + ' ' + path + ' ' + text);
    }
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) return resp.json();
    return null;
  }

  async function _apiSafe(method, path, body) {
    try {
      return await _api(method, path, body);
    } catch (e) {
      console.warn('[StorageService] API fail', method, path, e.message || e);
      return null;
    }
  }

  const StorageService = {
    KEYS,
    API_BASE,
    SPACE_OPTIONS: SPACE_OPTIONS,
    DEFAULT_SLOTS: DEFAULT_SLOTS,

    ready: function () {
      return _readyPromise;
    },

    isHydrated: function () {
      return _hydrated;
    },

    hydrateFromServer: async function () {
      try {
        const snap = await _api('GET', '/api/snapshot');
        _applySnapshot(snap);
        _hydrated = true;
        return snap;
      } catch (e) {
        console.warn('[StorageService] hydrate fail, local fallback', e.message || e);
        _toastOnce('统一库暂不可用，已切换本地缓存（请确认已启动 server:8787）');
        StorageService.seedIfEmptyLocal();
        _hydrated = true;
        return null;
      } finally {
        if (_readyResolve) {
          _readyResolve(true);
          _readyResolve = null;
        }
      }
    },

    seedIfEmptyLocal: function () {
      const mentors = _read(KEYS.mentors, null);
      if (!mentors || !Array.isArray(mentors) || mentors.length === 0) {
        _write(KEYS.mentors, getSeedMentors().map(_withMentorDefaults));
      } else {
        let needWrite = false;
        const patched = mentors.map((m) => {
          if (!m.availableSlots || !m.availableSlots.length || !m.preferredSpaces) {
            needWrite = true;
            return _withMentorDefaults(m);
          }
          return m;
        });
        if (needWrite) _write(KEYS.mentors, patched);
      }
      const parents = _read(KEYS.parents, null);
      if (!parents || !Array.isArray(parents) || parents.length === 0) {
        _write(KEYS.parents, [getSeedParent()]);
      }
      const bookings = _read(KEYS.bookings, null);
      if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
        _write(KEYS.bookings, getSeedBookings());
      }
      const assessments = _read(KEYS.assessments, null);
      if (!assessments || !Array.isArray(assessments)) {
        _write(KEYS.assessments, []);
      }
      if (!_read(KEYS.seeded, false)) _write(KEYS.seeded, true);
      return true;
    },

    /** 若服务端有数据则拉 snapshot；本地空且服务端空时由服务端 seed；离线则本地 seed */
    seedIfEmpty: function () {
      // 同步路径：保证本地非空；真正与服务器对齐靠 hydrate / ready
      this.seedIfEmptyLocal();
      // 异步：若尚未 hydrate，触发一次
      if (!_hydrated) {
        this.hydrateFromServer();
      }
      return true;
    },

    resetDemoData: async function () {
      const snap = await _apiSafe('POST', '/api/reset');
      if (snap) {
        _applySnapshot(snap);
        return true;
      }
      _write(KEYS.mentors, getSeedMentors().map(_withMentorDefaults));
      _write(KEYS.parents, [getSeedParent()]);
      _write(KEYS.bookings, getSeedBookings());
      _write(KEYS.contracts, []);
      _write(KEYS.assessments, []);
      return true;
    },

    /* ---------- Mentors ---------- */
    getMentors: function () {
      this.seedIfEmptyLocal();
      return _read(KEYS.mentors, []);
    },

    saveMentors: function (list) {
      return _write(KEYS.mentors, list || []);
    },

    getMentorById: function (id) {
      return this.getMentors().find((m) => m.id === id) || null;
    },

    getMentorByPhone: function (phone) {
      if (!phone) return null;
      const p = String(phone).trim();
      return this.getMentors().find((m) => m.phone && String(m.phone).trim() === p) || null;
    },

    getCurrentMentor: function () {
      this.seedIfEmptyLocal();
      const session = this.getSession();
      if (!session) return null;
      if (session.mentorId) {
        const byId = this.getMentorById(session.mentorId);
        if (byId) return byId;
      }
      if (session.phone) return this.getMentorByPhone(session.phone);
      return null;
    },

    updateMentorProfile: function (id, patch, options) {
      const opts = options || {};
      const list = this.getMentors();
      const idx = list.findIndex((m) => m.id === id);
      if (idx < 0) return null;
      const next = Object.assign({}, list[idx], patch || {}, { updatedAt: _now() });
      if (opts.sensitiveChange) {
        next.status = 'pending';
        next.sensitiveChangePending = true;
        next.reviewComment = next.reviewComment || '';
        if (!String(next.reviewComment).includes('敏感信息变更')) {
          next.reviewComment = '【敏感信息变更待复审】' + (next.reviewComment || '');
        }
      }
      if (Array.isArray(next.preferredSpaces) && next.preferredSpaces.length) {
        next.spacePreference = next.preferredSpaces[0];
      }
      list[idx] = _withMentorDefaults(next);
      this.saveMentors(list);
      const body = Object.assign({}, patch || {}, { _options: opts });
      _apiSafe('PATCH', '/api/mentors/' + encodeURIComponent(id), body).then((remote) => {
        if (remote) {
          const all = this.getMentors();
          const i = all.findIndex((m) => m.id === id);
          if (i >= 0) {
            all[i] = _withMentorDefaults(remote);
            this.saveMentors(all);
          }
        }
      });
      return list[idx];
    },

    addMentor: function (mentor) {
      const list = this.getMentors();
      const record = Object.assign(
        {
          id: _uid('AP'),
          code: 'CD-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
          status: 'pending',
          submitTime: _now(),
          evalGrade: '待教研评级',
          reviewComment: '',
          publicTeacherCompliance: true,
          customSubjects: [],
          proofFiles: [],
          styles: [],
          subjects: []
        },
        mentor
      );
      const normalized = _withMentorDefaults(record);
      list.unshift(normalized);
      this.saveMentors(list);
      const session = this.getSession() || {};
      session.role = 'mentor';
      session.mentorId = normalized.id;
      session.phone = normalized.phone || session.phone;
      this.setSession(session);
      _apiSafe('POST', '/api/mentors', mentor || {}).then((remote) => {
        if (remote && remote.id) {
          // 用服务端 id 替换本地临时 id
          const all = this.getMentors().filter((m) => m.id !== normalized.id);
          all.unshift(_withMentorDefaults(remote));
          this.saveMentors(all);
          const s = this.getSession() || {};
          s.mentorId = remote.id;
          s.phone = remote.phone || s.phone;
          this.setSession(s);
        }
      });
      return normalized;
    },

    updateMentor: function (id, patch) {
      const list = this.getMentors();
      const idx = list.findIndex((m) => m.id === id);
      if (idx < 0) return null;
      list[idx] = Object.assign({}, list[idx], patch, { updatedAt: _now() });
      this.saveMentors(list);
      _apiSafe('PATCH', '/api/mentors/' + encodeURIComponent(id), patch || {});
      return list[idx];
    },

    getPendingMentors: function () {
      return this.getMentors().filter((m) => m.status === 'pending');
    },

    getApprovedMentors: function () {
      return this.getMentors().filter((m) => m.status === 'approved');
    },

    /* ---------- Parents ---------- */
    getParents: function () {
      this.seedIfEmptyLocal();
      return _read(KEYS.parents, []);
    },

    normalizeParentProfile: function (p) {
      if (!p || typeof p !== 'object') return p;
      const out = Object.assign({}, p);
      if (out.budgetMin == null && out.budgetMax == null && out.budgetRate != null) {
        const mid = Number(out.budgetRate) || 130;
        out.budgetMin = Math.max(70, mid - 30);
        out.budgetMax = Math.min(240, mid + 30);
      }
      if (out.budgetMin == null) out.budgetMin = 80;
      if (out.budgetMax == null) out.budgetMax = 180;
      if (out.budgetRate == null) {
        out.budgetRate = Math.round((Number(out.budgetMin) + Number(out.budgetMax)) / 2);
      }
      if (!out.subjectPlans || typeof out.subjectPlans !== 'object') {
        out.subjectPlans = {};
        if (out.subjects && out.subjects.length && (out.syllabusTopics || out.painTags || out.pacingMode)) {
          const topics = out.syllabusTopics || [];
          const pains = out.painTags || [];
          const pacing = out.pacingMode || '紧贴校内进度 · 随堂查漏补缺';
          out.subjects.forEach(function (s, i) {
            out.subjectPlans[s] = {
              weakPoints: i === 0 ? topics.slice() : [],
              pacing: pacing,
              pains: i === 0 ? pains.slice() : []
            };
          });
        }
      }
      if (!Array.isArray(out.syllabusTopics)) {
        const flat = [];
        Object.keys(out.subjectPlans).forEach(function (s) {
          (out.subjectPlans[s].weakPoints || []).forEach(function (t) {
            if (flat.indexOf(t) < 0) flat.push(t);
          });
        });
        out.syllabusTopics = flat;
      }
      if (!Array.isArray(out.painTags)) {
        const flat = [];
        Object.keys(out.subjectPlans).forEach(function (s) {
          (out.subjectPlans[s].pains || []).forEach(function (t) {
            if (flat.indexOf(t) < 0) flat.push(t);
          });
        });
        out.painTags = flat;
      }
      return out;
    },

    saveParent: function (profile) {
      const list = this.getParents();
      const incoming = this.normalizeParentProfile(profile || {}) || {};
      let idx = -1;
      if (incoming.id) idx = list.findIndex((p) => p.id === incoming.id);
      if (idx < 0 && incoming.phone) {
        const phone = String(incoming.phone).trim();
        idx = list.findIndex((p) => p.phone && String(p.phone).trim() === phone);
      }
      const record = Object.assign(
        {
          id: (idx >= 0 && list[idx].id) || incoming.id || _uid('PAR'),
          createdAt: (idx >= 0 && list[idx].createdAt) || _now()
        },
        incoming,
        { updatedAt: _now() }
      );
      if (idx >= 0) {
        record.id = list[idx].id;
        record.createdAt = list[idx].createdAt || record.createdAt;
        list[idx] = record;
      } else {
        list.unshift(record);
      }
      _write(KEYS.parents, list);
      const session = this.getSession() || {};
      session.role = 'parent';
      session.parentId = record.id;
      session.phone = record.phone;
      this.setSession(session);
      _apiSafe('POST', '/api/parents', record).then((remote) => {
        if (remote) {
          const all = this.getParents();
          let i = all.findIndex((p) => p.id === record.id);
          if (i < 0 && remote.phone) {
            i = all.findIndex((p) => p.phone === remote.phone);
          }
          if (i >= 0) all[i] = remote;
          else all.unshift(remote);
          _write(KEYS.parents, all);
        }
      });
      return record;
    },

    getCurrentParent: function () {
      this.seedIfEmptyLocal();
      const session = this.getSession();
      const list = this.getParents();
      let found = null;
      if (session && session.parentId) {
        found = list.find((p) => p.id === session.parentId) || null;
      }
      if (!found && session && session.phone) {
        found = list.find((p) => p.phone === session.phone) || null;
      }
      if (!found) found = list[0] || null;
      return found ? this.normalizeParentProfile(found) : null;
    },

    /* ---------- Bookings & Contracts ---------- */
    getBookings: function () {
      this.seedIfEmptyLocal();
      return _read(KEYS.bookings, []);
    },

    saveBookings: function (list) {
      return _write(KEYS.bookings, list || []);
    },

    getBookingById: function (id) {
      return this.getBookings().find((b) => b.id === id) || null;
    },

    addBooking: function (booking) {
      const list = this.getBookings();
      const mentorId = (booking && (booking.mentorId || booking.tutorId)) || '';
      const bookingType = (booking && booking.type) || 'one_off';
      if (bookingType === 'trial') {
        const parentKey = (booking && (booking.parentId || booking.parentPhone)) || '';
        const subject = (booking && booking.subject) || '';
        if (parentKey && this.hasUsedFreeTrial(parentKey, mentorId, subject)) {
          const err = { ok: false, error: '每位导师同一学科仅可预约一次免费试课', code: 'TRIAL_USED' };
          console.warn('[StorageService] trial blocked', err);
          return err;
        }
      }
      const record = Object.assign(
        {
          id: _uid('BK'),
          createdAt: _now(),
          status: 'pending_accept',
          declineReason: '',
          mentorId: mentorId,
          tutorId: mentorId,
          type: bookingType,
          sessions: (booking && booking.sessions) || [],
          escrowStatus: (booking && booking.escrowStatus) || 'frozen'
        },
        booking,
        {
          mentorId: mentorId || (booking && booking.mentorId) || '',
          tutorId: mentorId || (booking && (booking.tutorId || booking.mentorId)) || ''
        }
      );
      if (record.type === 'trial') {
        record.hours = 1;
        record.amount = 0;
        record.perSessionAmount = 0;
        record.escrowStatus = 'waived';
        record.trialLabel = '首次试课 · 1小时免费';
        record.sessionCount = 1;
      }
      list.unshift(record);
      this.saveBookings(list);
      _apiSafe('POST', '/api/bookings', booking || record).then((remote) => {
        if (remote && remote.id) {
          const all = this.getBookings().filter((b) => b.id !== record.id);
          all.unshift(remote);
          this.saveBookings(all);
        }
      });
      return record;
    },

    getBookingsForMentor: function (mentorId) {
      if (!mentorId) return [];
      return this.getBookings().filter(
        (b) => b.mentorId === mentorId || b.tutorId === mentorId
      );
    },

    getBookingsForParent: function (parentIdOrPhone) {
      if (!parentIdOrPhone) return [];
      const key = String(parentIdOrPhone).trim();
      const parents = this.getParents();
      const parent = parents.find((p) => p.id === key || String(p.phone || '') === key) || null;
      const id = parent ? parent.id : key;
      const phone = parent ? String(parent.phone || '') : (/^1\d{10}$/.test(key) ? key : '');
      return this.getBookings().filter((b) => {
        if (b.parentId && (b.parentId === id || b.parentId === key)) return true;
        if (phone && b.parentPhone && String(b.parentPhone) === phone) return true;
        return false;
      });
    },

    /**
     * 统一已完课行：从约课列表展开 status===completed 的课次。
     * mentor / parent / admin 共用，保证同一种子可见同一批 bookingId + session。
     */
    collectCompletedSessions: function (list) {
      const rows = [];
      (list || []).forEach((raw) => {
        const b = this.normalizeBookingRecord(raw);
        (b.sessions || []).forEach((s) => {
          if (s && s.status === 'completed') rows.push({ booking: b, session: s });
        });
      });
      rows.sort((a, b) =>
        String(b.session.completedAt || b.session.date || '').localeCompare(
          String(a.session.completedAt || a.session.date || '')
        )
      );
      return rows;
    },

    /** opts: { mentorId?, parentId?, parentPhone? } — 平台级不传则全量 */
    getCompletedSessions: function (opts) {
      opts = opts || {};
      let list = this.getBookings();
      if (opts.mentorId) {
        const mid = opts.mentorId;
        list = list.filter((b) => b.mentorId === mid || b.tutorId === mid);
      }
      if (opts.parentId || opts.parentPhone) {
        const pid = opts.parentId || '';
        const phone = opts.parentPhone ? String(opts.parentPhone) : '';
        list = list.filter((b) => {
          if (pid && b.parentId === pid) return true;
          if (phone && b.parentPhone && String(b.parentPhone) === phone) return true;
          return false;
        });
      }
      return this.collectCompletedSessions(list);
    },

    respondToBooking: function (id, decision) {
      const list = this.getBookings();
      const idx = list.findIndex((b) => b.id === id);
      if (idx < 0) return null;
      const d = decision || {};
      const accept = d.accept === true || d.action === 'accept';
      const decline = d.accept === false || d.decline === true || d.action === 'decline';
      if (accept) {
        list[idx] = Object.assign({}, list[idx], {
          status: 'accepted', declineReason: '', respondedAt: _now()
        });
      } else if (decline) {
        list[idx] = Object.assign({}, list[idx], {
          status: 'declined',
          declineReason: d.reason || d.declineReason || '导师暂时无法承接此时段',
          respondedAt: _now()
        });
      } else {
        return list[idx];
      }
      this.saveBookings(list);
      _apiSafe('POST', '/api/bookings/' + encodeURIComponent(id) + '/respond', d).then((remote) => {
        if (remote) {
          const all = this.getBookings();
          const i = all.findIndex((b) => b.id === id);
          if (i >= 0) {
            all[i] = remote;
            this.saveBookings(all);
          }
        }
      });
      return list[idx];
    },

    updateBooking: function (id, patch) {
      const list = this.getBookings();
      const idx = list.findIndex((b) => b.id === id);
      if (idx < 0) return null;
      list[idx] = Object.assign({}, list[idx], patch || {}, { updatedAt: _now() });
      this.saveBookings(list);
      _apiSafe('PATCH', '/api/bookings/' + encodeURIComponent(id), patch || {});
      return list[idx];
    },


    /* ---------- Weekly booking + leave + 48h escrow ---------- */
    WEEKDAY_LABELS: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],

    buildWeeklySessions: function (weekday, timeStart, hours, sessionCount, startDateStr) {
      const count = Math.max(1, Math.min(24, parseInt(sessionCount, 10) || 4));
      const wd = parseInt(weekday, 10);
      const h = Math.max(1, parseInt(hours, 10) || 2);
      const [sh, sm] = String(timeStart || '19:00').split(':').map(Number);
      let cursor = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
      cursor.setHours(0, 0, 0, 0);
      // start from tomorrow at earliest so leave 24h rule is meaningful
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (cursor < tomorrow) cursor = tomorrow;
      const sessions = [];
      let guard = 0;
      while (sessions.length < count && guard < 400) {
        guard += 1;
        if (cursor.getDay() === wd) {
          const y = cursor.getFullYear();
          const m = String(cursor.getMonth() + 1).padStart(2, '0');
          const d = String(cursor.getDate()).padStart(2, '0');
          const dateStr = y + '-' + m + '-' + d;
          const endH = sh + h;
          const endM = sm || 0;
          const timeEnd = String(endH).padStart(2, '0') + ':' + String(endM).padStart(2, '0');
          const timeLabel = String(timeStart || '19:00') + '-' + timeEnd;
          const leaveDeadlineDate = new Date(cursor);
          leaveDeadlineDate.setDate(leaveDeadlineDate.getDate() - 1);
          leaveDeadlineDate.setHours(23, 59, 59, 0);
          const ly = leaveDeadlineDate.getFullYear();
          const lm = String(leaveDeadlineDate.getMonth() + 1).padStart(2, '0');
          const ld = String(leaveDeadlineDate.getDate()).padStart(2, '0');
          sessions.push({
            id: 'SES-' + dateStr.replace(/-/g, '') + '-' + sessions.length,
            date: dateStr,
            weekday: wd,
            weekdayLabel: this.WEEKDAY_LABELS[wd] || '',
            timeStart: timeStart || '19:00',
            timeEnd: timeEnd,
            timeLabel: timeLabel,
            status: 'scheduled',
            escrowStatus: 'frozen',
            leaveRequestedAt: '',
            leaveConfirmedAt: '',
            leaveRequestedBy: '',
            leaveDeadline: ly + '-' + lm + '-' + ld + ' 23:59',
            completedAt: '',
            releaseAt: ''
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return sessions;
    },

    normalizeBookingRecord: function (booking) {
      const b = Object.assign({}, booking || {});
      if (!b.type) b.type = 'one_off';
      if (!Array.isArray(b.sessions)) b.sessions = [];
      if (b.type === 'one_off' && b.sessions.length === 0 && b.schedule) {
        // lightweight single-session mirror for leave/escrow UI
        b.sessions = [{
          id: 'SES-ONE-' + (b.id || 'X'),
          date: '',
          status: b.status === 'accepted' ? 'scheduled' : (b.status || 'scheduled'),
          escrowStatus: 'frozen',
          leaveRequestedAt: '',
          leaveConfirmedAt: '',
          leaveDeadline: '',
          timeLabel: b.timeSlot || b.schedule || ''
        }];
      }
      return b;
    },

    requestSessionLeave: function (bookingId, sessionId, byRole) {
      const list = this.getBookings();
      const idx = list.findIndex((b) => b.id === bookingId);
      if (idx < 0) return { ok: false, error: '约课不存在' };
      const booking = Object.assign({}, list[idx]);
      if (!Array.isArray(booking.sessions)) booking.sessions = [];
      const sIdx = booking.sessions.findIndex((s) => s.id === sessionId);
      if (sIdx < 0) return { ok: false, error: '课次不存在' };
      const session = Object.assign({}, booking.sessions[sIdx]);
      if (session.status === 'leave_approved' || session.status === 'cancelled') {
        return { ok: false, error: '该课次已请假或已取消' };
      }
      if (session.status === 'completed') {
        return { ok: false, error: '已完成课次不可请假' };
      }
      // 提前一日：须在 leaveDeadline 前，或距开课 >= 24h
      const now = new Date();
      let tooLate = false;
      if (session.date && session.timeStart) {
        const [hh, mm] = String(session.timeStart).split(':').map(Number);
        const start = new Date(session.date + 'T00:00:00');
        start.setHours(hh || 0, mm || 0, 0, 0);
        const msLeft = start.getTime() - now.getTime();
        if (msLeft < 24 * 3600 * 1000) tooLate = true;
      } else if (session.leaveDeadline) {
        const dl = new Date(String(session.leaveDeadline).replace(' ', 'T'));
        if (!isNaN(dl.getTime()) && now > dl) tooLate = true;
      }
      if (tooLate) {
        session.status = 'leave_too_late';
        booking.sessions[sIdx] = session;
        list[idx] = booking;
        this.saveBookings(list);
        this.updateBooking(bookingId, { sessions: booking.sessions });
        return { ok: false, error: '请假须提前一日确认（开课前满 24 小时）', tooLate: true, booking: booking };
      }
      session.status = 'leave_pending';
      session.leaveRequestedAt = _now();
      session.leaveRequestedBy = byRole || 'parent';
      booking.sessions[sIdx] = session;
      list[idx] = Object.assign({}, booking, { updatedAt: _now() });
      this.saveBookings(list);
      this.updateBooking(bookingId, { sessions: booking.sessions, updatedAt: _now() });
      _apiSafe('POST', '/api/bookings/' + encodeURIComponent(bookingId) + '/leave', {
        sessionId: sessionId, action: 'request', byRole: byRole || 'parent'
      });
      return { ok: true, booking: list[idx], session: session };
    },

    confirmSessionLeave: function (bookingId, sessionId, approve) {
      const list = this.getBookings();
      const idx = list.findIndex((b) => b.id === bookingId);
      if (idx < 0) return { ok: false, error: '约课不存在' };
      const booking = Object.assign({}, list[idx]);
      if (!Array.isArray(booking.sessions)) return { ok: false, error: '无课次' };
      const sIdx = booking.sessions.findIndex((s) => s.id === sessionId);
      if (sIdx < 0) return { ok: false, error: '课次不存在' };
      const session = Object.assign({}, booking.sessions[sIdx]);
      if (session.status !== 'leave_pending' && session.status !== 'leave_too_late') {
        return { ok: false, error: '当前课次无可确认的请假' };
      }
      if (approve === false) {
        session.status = 'scheduled';
        session.leaveRequestedAt = '';
        session.leaveRequestedBy = '';
      } else {
        // re-check 24h rule at confirm time
        const now = new Date();
        if (session.date && session.timeStart) {
          const [hh, mm] = String(session.timeStart).split(':').map(Number);
          const start = new Date(session.date + 'T00:00:00');
          start.setHours(hh || 0, mm || 0, 0, 0);
          if (start.getTime() - now.getTime() < 24 * 3600 * 1000) {
            session.status = 'leave_too_late';
            booking.sessions[sIdx] = session;
            list[idx] = booking;
            this.saveBookings(list);
            this.updateBooking(bookingId, { sessions: booking.sessions });
            return { ok: false, error: '已不足提前一日，无法批准请假', tooLate: true, booking: booking };
          }
        }
        session.status = 'leave_approved';
        session.leaveConfirmedAt = _now();
        session.escrowStatus = 'released'; // 请假课次解除冻结（演示：退回托管池）
      }
      booking.sessions[sIdx] = session;
      list[idx] = Object.assign({}, booking, { updatedAt: _now() });
      this.saveBookings(list);
      this.updateBooking(bookingId, { sessions: booking.sessions });
      _apiSafe('POST', '/api/bookings/' + encodeURIComponent(bookingId) + '/leave', {
        sessionId: sessionId, action: approve === false ? 'reject' : 'confirm'
      });
      return { ok: true, booking: list[idx], session: session };
    },

    markSessionCompleted: function (bookingId, sessionId, meta) {
      return this.completeSession(bookingId, sessionId, meta || {});
    },

    completeSession: function (bookingId, sessionId, meta) {
      const opts = meta || {};
      const list = this.getBookings();
      const idx = list.findIndex((b) => b.id === bookingId);
      if (idx < 0) return { ok: false, error: '约课不存在' };
      let booking = Object.assign({}, list[idx]);
      booking = this.normalizeBookingRecord(booking);
      if (!Array.isArray(booking.sessions) || !booking.sessions.length) {
        return { ok: false, error: '无课次可结课' };
      }
      const sIdx = booking.sessions.findIndex((s) => s.id === sessionId);
      if (sIdx < 0) return { ok: false, error: '课次不存在' };
      const session = Object.assign({}, booking.sessions[sIdx]);
      if (session.status === 'completed') {
        return { ok: true, booking: booking, session: session, already: true };
      }
      if (session.status === 'leave_approved' || session.status === 'cancelled') {
        return { ok: false, error: '已请假/取消的课次不可结课' };
      }
      session.status = 'completed';
      session.completedAt = _now();
      session.completedBy = opts.completedBy || 'mentor';
      session.escrowStatus = 'frozen';
      const release = new Date();
      release.setHours(release.getHours() + 48);
      const pad = (n) => String(n).padStart(2, '0');
      session.releaseAt = release.getFullYear() + '-' + pad(release.getMonth() + 1) + '-' + pad(release.getDate()) +
        ' ' + pad(release.getHours()) + ':' + pad(release.getMinutes());
      if (opts.classSummary) {
        session.classSummary = this._normalizeClassSummary(opts.classSummary, opts.mentorId || booking.mentorId);
      }
      booking.sessions[sIdx] = session;
      // one-off booking status mirror
      if (booking.type === 'one_off' || (booking.sessions.length === 1 && booking.status === 'accepted')) {
        booking.completedAt = session.completedAt;
      }
      list[idx] = Object.assign({}, booking, { updatedAt: _now() });
      this.saveBookings(list);
      this.updateBooking(bookingId, { sessions: booking.sessions, completedAt: booking.completedAt, updatedAt: _now() });
      _apiSafe('POST', '/api/bookings/' + encodeURIComponent(bookingId) + '/complete', {
        sessionId: sessionId,
        completedBy: session.completedBy,
        classSummary: session.classSummary || null
      });
      return { ok: true, booking: list[idx], session: session };
    },

    _normalizeClassSummary: function (summary, mentorId) {
      if (summary == null || summary === '') return null;
      if (typeof summary === 'string') {
        return {
          title: '',
          content: summary,
          tags: [],
          createdAt: _now(),
          mentorId: mentorId || ''
        };
      }
      const tags = Array.isArray(summary.tags) ? summary.tags.slice() : [];
      return {
        title: summary.title || '',
        content: summary.content || summary.body || '',
        tags: tags,
        createdAt: summary.createdAt || _now(),
        mentorId: summary.mentorId || mentorId || ''
      };
    },

    saveClassSummary: function (bookingId, sessionId, summary, mentorId) {
      const list = this.getBookings();
      const idx = list.findIndex((b) => b.id === bookingId);
      if (idx < 0) return { ok: false, error: '约课不存在' };
      let booking = this.normalizeBookingRecord(Object.assign({}, list[idx]));
      const sIdx = (booking.sessions || []).findIndex((s) => s.id === sessionId);
      if (sIdx < 0) return { ok: false, error: '课次不存在' };
      const session = Object.assign({}, booking.sessions[sIdx]);
      const normalized = this._normalizeClassSummary(summary, mentorId || booking.mentorId);
      if (!normalized || !String(normalized.content || '').trim()) {
        return { ok: false, error: '请填写课后小结内容' };
      }
      session.classSummary = normalized;
      booking.sessions[sIdx] = session;
      list[idx] = Object.assign({}, booking, { updatedAt: _now() });
      this.saveBookings(list);
      this.updateBooking(bookingId, { sessions: booking.sessions });
      _apiSafe('POST', '/api/bookings/' + encodeURIComponent(bookingId) + '/summary', {
        sessionId: sessionId,
        classSummary: normalized
      });
      return { ok: true, booking: list[idx], session: session };
    },

    getClassSummary: function (bookingId, sessionId) {
      const booking = this.getBookingById(bookingId);
      if (!booking) return null;
      const b = this.normalizeBookingRecord(booking);
      const session = (b.sessions || []).find((s) => s.id === sessionId);
      return (session && session.classSummary) || null;
    },

    buildRenewalBooking: function (sourceBookingId, overrides) {
      const src = this.getBookingById(sourceBookingId);
      if (!src) return { ok: false, error: '原约课不存在' };
      const o = overrides || {};
      const hours = o.hours != null ? o.hours : (src.hours || 2);
      const type = o.type || src.type || 'one_off';
      const srcNorm = this.normalizeBookingRecord(src);
      const sampleSession = (srcNorm.sessions || []).filter(function (s) { return s.status !== 'leave_approved' && s.status !== 'cancelled'; }).slice(-1)[0]
        || (srcNorm.sessions || [])[0];
      const weekday = o.weekday != null ? o.weekday : (src.weekday != null ? src.weekday : (sampleSession && sampleSession.weekday));
      const timeStart = o.time || o.timeStart || src.time || (sampleSession && sampleSession.timeStart) || '19:00';
      const sessionCount = o.sessionCount != null ? o.sessionCount : (src.sessionCount || 4);
      let sessions = [];
      if (type === 'weekly') {
        sessions = this.buildWeeklySessions(weekday, timeStart, hours, sessionCount);
      }
      const draft = {
        sourceBookingId: src.id,
        mentorId: src.mentorId || src.tutorId,
        tutorId: src.tutorId || src.mentorId,
        tutorName: src.tutorName,
        parentId: src.parentId,
        parentName: src.parentName,
        parentPhone: src.parentPhone,
        studentNickname: src.studentNickname,
        studentGrade: src.studentGrade,
        subject: o.subject || src.subject,
        space: o.space || src.space,
        hours: hours,
        type: type,
        weekday: type === 'weekly' ? weekday : undefined,
        time: type === 'weekly' ? timeStart : undefined,
        sessionCount: type === 'weekly' ? sessionCount : 1,
        sessions: sessions,
        hourlyRate: o.hourlyRate || src.hourlyRate || (src.amount && hours ? Math.round(src.amount / hours / (src.sessionCount || 1)) : undefined),
        amount: o.amount,
        schedule: o.schedule,
        timeSlot: o.timeSlot || src.timeSlot,
        escrowStatus: 'frozen',
        status: 'pending_accept',
        prefill: {
          type: type,
          weekday: weekday,
          timeStart: timeStart,
          sessionCount: sessionCount,
          hours: hours,
          space: o.space || src.space,
          subject: o.subject || src.subject
        }
      };
      return { ok: true, draft: draft, source: src };
    },

    setMentorAvailability: function (mentorId, availability) {
      const normalized = (availability || []).map((item) => ({
        weekday: parseInt(item.weekday, 10),
        ranges: (item.ranges || []).map((r) => ({ start: r.start, end: r.end })).filter((r) => r.start && r.end)
      })).filter((item) => !isNaN(item.weekday) && item.ranges.length);
      const slots = _availabilityToSlotLabels(normalized);
      return this.updateMentorProfile(mentorId, {
        availability: normalized,
        availableSlots: slots
      }, { sensitiveChange: false });
    },

    getMentorAvailability: function (mentorId) {
      const m = this.getMentorById(mentorId);
      if (!m) return [];
      if (Array.isArray(m.availability) && m.availability.length) return m.availability;
      return _parseSlotLabelToAvailability(m.availableSlots || []);
    },

    availabilityHintsForWeekly: function (mentorId) {
      const avail = this.getMentorAvailability(mentorId);
      const hints = [];
      avail.forEach((item) => {
        (item.ranges || []).forEach((r) => {
          hints.push({
            weekday: item.weekday,
            weekdayLabel: this.WEEKDAY_LABELS[item.weekday] || '',
            timeStart: r.start,
            timeEnd: r.end,
            label: (this.WEEKDAY_LABELS[item.weekday] || '') + ' ' + r.start + '-' + r.end
          });
        });
      });
      return hints;
    },

    processEscrowReleases: function () {
      const list = this.getBookings();
      let changed = false;
      const now = new Date();
      list.forEach((b, bi) => {
        if (!Array.isArray(b.sessions)) return;
        let sessChanged = false;
        const sessions = b.sessions.map((s) => {
          if (s.status === 'completed' && s.escrowStatus === 'frozen' && s.releaseAt) {
            const t = new Date(String(s.releaseAt).replace(' ', 'T'));
            if (!isNaN(t.getTime()) && now >= t) {
              sessChanged = true;
              changed = true;
              return Object.assign({}, s, { escrowStatus: 'released' });
            }
          }
          return s;
        });
        if (sessChanged) {
          list[bi] = Object.assign({}, b, { sessions: sessions, updatedAt: _now() });
        }
      });
      if (changed) this.saveBookings(list);
      return list;
    },

    getContracts: function () {
      return _read(KEYS.contracts, []);
    },

    saveContract: function (contract) {
      const list = this.getContracts();
      const record = Object.assign({ id: _uid('CT'), signedAt: _now() }, contract);
      list.unshift(record);
      _write(KEYS.contracts, list);
      _apiSafe('POST', '/api/contracts', contract || record);
      return record;
    },

    /* ---------- Session ---------- */
    setSession: function (session) {
      _write(KEYS.session, session || {});
      _apiSafe('PUT', '/api/session', session || {});
      return true;
    },

    getSession: function () {
      return _read(KEYS.session, null);
    },

    clearSession: function () {
      localStorage.removeItem(KEYS.session);
      _apiSafe('PUT', '/api/session', {});
    },

    /* ---------- Matching helpers ---------- */
    _subjectOverlap: function (mentorSubjects, parentSubjects) {
      if (!parentSubjects || parentSubjects.length === 0) return 0.5;
      const ms = (mentorSubjects || []).map((s) => String(s).toLowerCase());
      let hits = 0;
      parentSubjects.forEach((ps) => {
        const p = String(ps).toLowerCase();
        if (ms.some((m) => m.includes(p) || p.includes(m.replace(/初中|高中|小学|考研/g, '')))) {
          hits += 1;
        }
      });
      return hits / parentSubjects.length;
    },

    mentorToTutorCard: function (mentor, parentProfile) {
      const surname = (mentor.realName || '导').charAt(0);
      const subjects = [].concat(mentor.subjects || [], mentor.customSubjects || []);
      const parentNorm = this.normalizeParentProfile(parentProfile || {}) || {};
      const parentSubjects = parentNorm.subjects || [];
      let parentTopics = parentNorm.syllabusTopics || [];
      if ((!parentTopics || !parentTopics.length) && parentNorm.subjectPlans) {
        parentTopics = [];
        Object.keys(parentNorm.subjectPlans).forEach(function (s) {
          (parentNorm.subjectPlans[s].weakPoints || []).forEach(function (t) {
            if (parentTopics.indexOf(t) < 0) parentTopics.push(t);
          });
        });
      }
      const budgetMin = Number(parentNorm.budgetMin) || 80;
      const budgetMax = Number(parentNorm.budgetMax) || 180;
      const budget = Number(parentNorm.budgetRate) || Math.round((budgetMin + budgetMax) / 2);
      const preferredSpace = parentNorm.selectedSpace || mentor.spacePreference || '青羊金沙文化微网点';
      const rate = Number(mentor.hourlyRate) || 120;
      const overlap = this._subjectOverlap(subjects, parentSubjects);
      let rateFit = 0.4;
      if (rate >= budgetMin && rate <= budgetMax) rateFit = 1;
      else if (rate < budgetMin && rate >= budgetMin * 0.85) rateFit = 0.75;
      else if (rate > budgetMax && rate <= budgetMax * 1.15) rateFit = 0.7;
      else if (rate <= budget * 1.4) rateFit = 0.55;
      const spaceFit = mentor.spacePreference === preferredSpace ? 1 : 0.85;
      const base = 88 + overlap * 8 + rateFit * 2 + spaceFit * 1.5;
      const matchScore = Math.min(99.5, Math.round(base * 10) / 10);
      const syllabusTopics =
        parentTopics.length > 0
          ? parentTopics.slice(0, 3)
          : (mentor.styles || []).slice(0, 3).concat(['考纲高频模型拆解']).slice(0, 3);
      const shortUni = (mentor.university || '').split(/[·/]/)[0].trim();
      const degreeShort = shortUni
        ? shortUni.replace('大学', '').slice(0, 6) + '·' + (subjects[0] || '辅导').replace(/初中|高中|小学/g, '').slice(0, 4)
        : '合规导师';
      return {
        id: 'TUTOR-' + (mentor.code || mentor.id || surname),
        mentorId: mentor.id,
        realName: mentor.realName,
        maskedName: surname + '老师',
        avatarLetter: surname,
        university: mentor.university,
        degree: mentor.degree || '',
        degreeShort: degreeShort,
        subjects: subjects,
        hourlyRate: Number(mentor.hourlyRate) || 120,
        rating: mentor.status === 'approved' ? 4.9 : 4.7,
        reviewCount: 20 + Math.floor((mentor.hourlyRate || 100) / 5),
        totalHours: 60 + Math.floor((mentor.hourlyRate || 100) / 2),
        space: mentor.spacePreference || preferredSpace,
        matchScore: matchScore,
        scoreHighlight: mentor.scoreHighlight || '合规实名 · 学信网核验通过',
        styles: mentor.styles && mentor.styles.length ? mentor.styles : ['引导启发解题'],
        syllabusTopics: syllabusTopics,
        videoTitle: (subjects[0] || '学科') + ' · 试讲示范课',
        lectureUrl: mentor.lectureUrl || '#',
        isTopMatch: matchScore >= 95,
        tagBadge: matchScore >= 96 ? matchScore + '% AI高契合' : mentor.evalGrade || '金牌导师',
        evalGrade: mentor.evalGrade || 'V2 级金牌导师',
        availableSlots: mentor.availableSlots || [],
        availability: mentor.availability || []
      };
    },

    /* ---------- Assessments（学生测评） ---------- */
    ASSESSMENT_SUBJECTS: ASSESSMENT_SUBJECTS,
    GRADE_BANDS: GRADE_BANDS,

    normalizeAssessmentSubject: normalizeAssessmentSubject,
    gradeBandFromGrade: gradeBandFromGrade,
    shortGradeLabel: shortGradeLabel,
    resolveAssessmentSubjectsForParent: resolveAssessmentSubjectsForParent,

    scoreToLevel: scoreToLevel,

    getAssessments: function () {
      this.seedIfEmptyLocal();
      return _read(KEYS.assessments, []) || [];
    },

    saveAssessments: function (list) {
      return _write(KEYS.assessments, list || []);
    },

    getAssessment: function (parentIdOrPhone, subject) {
      const sub = normalizeAssessmentSubject(subject);
      if (!parentIdOrPhone || !sub) return null;
      const keys = resolveParentKey(parentIdOrPhone);
      const list = this.getAssessments();
      const matches = list.filter((a) => {
        if (normalizeAssessmentSubject(a.subject) !== sub) return false;
        if (a.parentId && (a.parentId === keys.id || a.parentId === parentIdOrPhone)) return true;
        if (keys.phone && a.parentPhone && String(a.parentPhone) === keys.phone) return true;
        if (a.studentId && (a.studentId === keys.id || a.studentId === parentIdOrPhone)) return true;
        return false;
      });
      if (!matches.length) return null;
      matches.sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
      return matches[0];
    },

    hasAssessment: function (parentIdOrPhone, subject) {
      return !!this.getAssessment(parentIdOrPhone, subject);
    },

    saveAssessment: function (payload) {
      const sub = normalizeAssessmentSubject(payload && payload.subject);
      if (!sub) return null;
      const keys = resolveParentKey((payload && (payload.parentId || payload.parentPhone || payload.studentId)) || '');
      const score = Math.max(0, Math.min(100, Math.round(Number(payload && payload.score) || 0)));
      const record = Object.assign(
        {
          id: _uid('AS'),
          createdAt: _now()
        },
        payload || {},
        {
          subject: sub,
          score: score,
          level: (payload && payload.level) || scoreToLevel(score),
          completedAt: (payload && payload.completedAt) || _now(),
          parentId: (payload && payload.parentId) || keys.id || '',
          parentPhone: (payload && payload.parentPhone) || keys.phone || '',
          studentId: (payload && payload.studentId) || keys.id || ''
        }
      );
      const list = this.getAssessments().filter((a) => {
        // keep one latest per parent+subject (replace older same key)
        const sameSub = normalizeAssessmentSubject(a.subject) === sub;
        const sameParent =
          (record.parentId && a.parentId === record.parentId) ||
          (record.parentPhone && a.parentPhone && String(a.parentPhone) === String(record.parentPhone));
        return !(sameSub && sameParent);
      });
      list.unshift(record);
      this.saveAssessments(list);
      _apiSafe('POST', '/api/assessments', record).then((remote) => {
        if (remote && remote.id) {
          const all = this.getAssessments().filter((a) => a.id !== record.id && !(
            normalizeAssessmentSubject(a.subject) === sub &&
            ((remote.parentId && a.parentId === remote.parentId) ||
              (remote.parentPhone && a.parentPhone && String(a.parentPhone) === String(remote.parentPhone)))
          ));
          all.unshift(remote);
          this.saveAssessments(all);
        }
      });
      return record;
    },

    listAssessmentsForParent: function (parentIdOrPhone) {
      if (!parentIdOrPhone) return [];
      const keys = resolveParentKey(parentIdOrPhone);
      return this.getAssessments().filter((a) => {
        if (a.parentId && (a.parentId === keys.id || a.parentId === parentIdOrPhone)) return true;
        if (keys.phone && a.parentPhone && String(a.parentPhone) === keys.phone) return true;
        if (a.studentId && (a.studentId === keys.id || a.studentId === parentIdOrPhone)) return true;
        return false;
      });
    },

    /* ---------- Trial class（试课） ---------- */
    hasUsedFreeTrial: function (parentIdOrPhone, mentorId, subject) {
      const sub = normalizeAssessmentSubject(subject);
      const bookings = this.getBookingsForParent(parentIdOrPhone);
      return bookings.some((b) => {
        if (!b || b.type !== 'trial') return false;
        if (b.status === 'declined' || b.status === 'cancelled') return false;
        const sameMentor = !mentorId || b.mentorId === mentorId || b.tutorId === mentorId;
        const sameSubject = !sub || normalizeAssessmentSubject(b.subject) === sub;
        return sameMentor && sameSubject;
      });
    },

    getTutorListForParent: function (parentProfile) {
      const parent = parentProfile || this.getCurrentParent();
      const approved = this.getApprovedMentors();
      let tutors = approved.map((m) => this.mentorToTutorCard(m, parent));
      tutors.sort((a, b) => b.matchScore - a.matchScore);
      if (tutors.length === 0) {
        this.seedIfEmptyLocal();
        tutors = this.getApprovedMentors().map((m) => this.mentorToTutorCard(m, parent));
        tutors.sort((a, b) => b.matchScore - a.matchScore);
      }
      // 后台刷新：服务端匹配（不阻塞 UI）
      _apiSafe('POST', '/api/tutors/match', parent || {}).then((remote) => {
        if (remote && Array.isArray(remote) && remote.length) {
          // 仅作缓存提示，页面下次读取仍走本地 approved 映射，保证一致
        }
      });
      return tutors;
    }
  };

  // 自动 hydrate
  try {
    StorageService.seedIfEmptyLocal();
  } catch (e) {
    console.warn('[StorageService] local seed fail', e);
  }
  StorageService.hydrateFromServer();

  global.StorageService = StorageService;
})(typeof window !== 'undefined' ? window : globalThis);
