/**
 * 星火学伴 · 统一库（原子 JSON 文件）
 * 持久化：server/data/db.json
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const TMP_PATH = path.join(DATA_DIR, 'db.json.tmp');

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

function _now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function _uid(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
}

function availabilityToSlotLabels(availability) {
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

function parseSlotLabelToAvailability(slots) {
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

function withMentorDefaults(m) {
  const copy = Object.assign({}, m);
  if (!Array.isArray(copy.availability)) copy.availability = [];
  if ((!copy.availableSlots || !copy.availableSlots.length) && copy.availability.length) {
    copy.availableSlots = availabilityToSlotLabels(copy.availability);
  }
  if (copy.availableSlots == null) {
    copy.availableSlots = DEFAULT_SLOTS.slice();
  }
  if ((!copy.availability || !copy.availability.length) && copy.availableSlots && copy.availableSlots.length) {
    copy.availability = parseSlotLabelToAvailability(copy.availableSlots);
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
      id: 'BK-SEED-001',
      mentorId: 'AP-8802',
      tutorId: 'AP-8802',
      tutorName: '李老师',
      parentId: 'PAR-DEMO-001',
      parentName: '刘女士',
      parentPhone: '13980889211',
      studentNickname: '乐乐同学',
      studentGrade: '初三 (中考冲刺)',
      subject: '初中物理',
      space: '高新大源中央微网点',
      schedule: '2026-09-20 周六 14:00-16:00',
      timeSlot: '周六 14:00-16:00',
      amount: 220,
      hours: 2,
      status: 'pending_accept',
      type: 'one_off',
      sessions: [],
      escrowStatus: 'frozen',
      createdAt: '2026-09-14 16:20',
      declineReason: ''
    },
    {
      id: 'BK-SEED-002',
      mentorId: 'AP-8802',
      tutorId: 'AP-8802',
      tutorName: '李老师',
      parentId: 'PAR-DEMO-001',
      parentName: '刘女士',
      parentPhone: '13980889211',
      studentNickname: '乐乐同学',
      studentGrade: '初三 (中考冲刺)',
      subject: '初中数学',
      space: '高新大源中央微网点',
      schedule: '2026-09-21 周日 09:00-11:00',
      timeSlot: '周日 09:00-11:00',
      amount: 220,
      hours: 2,
      status: 'pending_accept',
      type: 'one_off',
      sessions: [],
      escrowStatus: 'frozen',
      createdAt: '2026-09-14 18:05',
      declineReason: ''
    },
    {
      id: 'BK-SEED-003',
      mentorId: 'AP-8803',
      tutorId: 'AP-8803',
      tutorName: '王老师',
      parentId: 'PAR-DEMO-001',
      parentName: '刘女士',
      parentPhone: '13980889211',
      studentNickname: '乐乐同学',
      studentGrade: '初三 (中考冲刺)',
      subject: '初中英语',
      space: '青羊金沙文化微网点',
      schedule: '2026-09-22 周一 19:00-21:00',
      timeSlot: '周一 19:00-21:00',
      amount: 240,
      hours: 2,
      status: 'pending_accept',
      type: 'one_off',
      sessions: [],
      escrowStatus: 'frozen',
      createdAt: '2026-09-14 20:40',
      declineReason: ''
    },
    {
      id: 'BK-SEED-004',
      mentorId: 'AP-8802',
      tutorId: 'AP-8802',
      tutorName: '李老师',
      parentId: 'PAR-DEMO-001',
      parentName: '刘女士',
      parentPhone: '13980889211',
      studentNickname: '乐乐同学',
      studentGrade: '初三 (中考冲刺)',
      subject: '初中物理',
      space: '高新大源中央微网点',
      schedule: '2026-09-06 周六 14:00-16:00',
      timeSlot: '周六 14:00-16:00',
      amount: 220,
      hours: 2,
      status: 'accepted',
      type: 'one_off',
      escrowStatus: 'released',
      completedAt: '2026-09-06 16:08',
      createdAt: '2026-09-04 10:15',
      declineReason: '',
      sessions: [{
        id: 'SES-SEED-004',
        date: '2026-09-06',
        weekday: 6,
        weekdayLabel: '周六',
        timeStart: '14:00',
        timeEnd: '16:00',
        timeLabel: '14:00-16:00',
        status: 'completed',
        escrowStatus: 'released',
        leaveRequestedAt: '',
        leaveConfirmedAt: '',
        leaveRequestedBy: '',
        leaveDeadline: '2026-09-05 23:59',
        completedAt: '2026-09-06 16:08',
        completedBy: 'mentor',
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
    {
      id: 'BK-SEED-005',
      mentorId: 'AP-8802',
      tutorId: 'AP-8802',
      tutorName: '李老师',
      parentId: 'PAR-DEMO-001',
      parentName: '刘女士',
      parentPhone: '13980889211',
      studentNickname: '乐乐同学',
      studentGrade: '初三 (中考冲刺)',
      subject: '初中数学',
      space: '高新大源中央微网点',
      schedule: '2026-09-14 周日 09:00-11:00',
      timeSlot: '周日 09:00-11:00',
      amount: 220,
      hours: 2,
      status: 'accepted',
      type: 'one_off',
      escrowStatus: 'frozen',
      completedAt: '2026-09-15 20:10',
      createdAt: '2026-09-12 14:30',
      declineReason: '',
      sessions: [{
        id: 'SES-SEED-005',
        date: '2026-09-14',
        weekday: 0,
        weekdayLabel: '周日',
        timeStart: '09:00',
        timeEnd: '11:00',
        timeLabel: '09:00-11:00',
        status: 'completed',
        escrowStatus: 'frozen',
        leaveRequestedAt: '',
        leaveConfirmedAt: '',
        leaveRequestedBy: '',
        leaveDeadline: '2026-09-13 23:59',
        completedAt: '2026-09-15 20:10',
        completedBy: 'mentor',
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
    {
      id: 'BK-SEED-006',
      mentorId: 'AP-8802',
      tutorId: 'AP-8802',
      tutorName: '李老师',
      parentId: 'PAR-DEMO-001',
      parentName: '刘女士',
      parentPhone: '13980889211',
      studentNickname: '乐乐同学',
      studentGrade: '初三 (中考冲刺)',
      subject: '初中物理',
      space: '高新大源中央微网点',
      schedule: '每周周六 14:00 · 共4次',
      timeSlot: '周六 14:00-16:00',
      amount: 880,
      hours: 2,
      status: 'accepted',
      type: 'weekly',
      weekday: 6,
      time: '14:00',
      sessionCount: 4,
      escrowStatus: 'frozen',
      createdAt: '2026-08-28 11:00',
      declineReason: '',
      sessions: [
        {
          id: 'SES-SEED-006-0',
          date: '2026-08-30',
          weekday: 6,
          weekdayLabel: '周六',
          timeStart: '14:00',
          timeEnd: '16:00',
          timeLabel: '14:00-16:00',
          status: 'completed',
          escrowStatus: 'released',
          leaveRequestedAt: '',
          leaveConfirmedAt: '',
          leaveRequestedBy: '',
          leaveDeadline: '2026-08-29 23:59',
          completedAt: '2026-08-30 16:05',
          completedBy: 'mentor',
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
          date: '2026-09-06',
          weekday: 6,
          weekdayLabel: '周六',
          timeStart: '14:00',
          timeEnd: '16:00',
          timeLabel: '14:00-16:00',
          status: 'completed',
          escrowStatus: 'released',
          leaveRequestedAt: '',
          leaveConfirmedAt: '',
          leaveRequestedBy: '',
          leaveDeadline: '2026-09-05 23:59',
          completedAt: '2026-09-06 16:00',
          completedBy: 'mentor',
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
          date: '2026-09-13',
          weekday: 6,
          weekdayLabel: '周六',
          timeStart: '14:00',
          timeEnd: '16:00',
          timeLabel: '14:00-16:00',
          status: 'completed',
          escrowStatus: 'frozen',
          leaveRequestedAt: '',
          leaveConfirmedAt: '',
          leaveRequestedBy: '',
          leaveDeadline: '2026-09-12 23:59',
          completedAt: '2026-09-15 19:40',
          completedBy: 'mentor',
          releaseAt: '2026-09-17 19:40',
          classSummary: null
        },
        {
          id: 'SES-SEED-006-3',
          date: '2026-09-20',
          weekday: 6,
          weekdayLabel: '周六',
          timeStart: '14:00',
          timeEnd: '16:00',
          timeLabel: '14:00-16:00',
          status: 'scheduled',
          escrowStatus: 'frozen',
          leaveRequestedAt: '',
          leaveConfirmedAt: '',
          leaveRequestedBy: '',
          leaveDeadline: '2026-09-19 23:59',
          completedAt: '',
          releaseAt: ''
        }
      ]
    }
  ];
}

function getSeedMentors() {
  return [
    {
      id: 'AP-8801',
      code: 'CD-2026-8809',
      realName: '张若愚',
      phone: '18628009821',
      idCard: '510107200208153412',
      university: '四川大学',
      province: '四川',
      degree: '硕士研究生在读',
      chsiCode: 'A98F72KL50198821',
      chsiStatus: '有效 (在籍)',
      chsiMajor: '应用数学专业 · 硕士 (2027年毕业)',
      publicTeacherCompliance: true,
      subjects: ['初中数学', '高中数学', '美术艺考文化课冲刺'],
      customSubjects: ['美术艺考文化课冲刺'],
      hourlyRate: 135,
      rateDifficulty: '容易成交',
      rateTierNote: '符合高中/艺考建议区间 (¥120-200/h)',
      scoreHighlight: '高考数学145分 · 全国数学竞赛二等奖',
      styles: ['引导启发解题', '大题压轴模型归纳', '思维导图教学'],
      proofFiles: [
        { name: '全国高中数学联赛一等奖证书.pdf', size: '2.1MB', verified: true },
        { name: '川大数学学院推免保研成绩单(前3%).jpg', size: '3.2MB', verified: true },
        { name: '全国大学生数学建模竞赛二等奖.pdf', size: '1.4MB', verified: true }
      ],
      lectureUrl: 'https://pan.baidu.com/s/1demoSparkLecture2026',
      status: 'pending',
      submitTime: '2026-09-09 18:24',
      evalGrade: 'V2 级金牌导师',
      reviewComment: '试讲讲解清晰，重点突出压轴函数解法模型，资质齐备，予以准入入库。',
      bankName: '招商银行',
      bankCardNumber: '6214830188901122',
      spacePreference: '青羊金沙文化微网点'
    },
    {
      id: 'AP-8802',
      code: 'CD-2026-8810',
      realName: '李思源',
      phone: '13880123456',
      idCard: '510104200305128910',
      university: '电子科技大学',
      province: '四川',
      degree: '本科在读 (大三)',
      chsiCode: 'B12E8890MN340112',
      chsiStatus: '有效 (在籍)',
      chsiMajor: '信息与软件工程专业 · 本科 (2027年毕业)',
      publicTeacherCompliance: true,
      subjects: ['初中物理', '初中数学', '初中全科答疑'],
      customSubjects: [],
      hourlyRate: 110,
      rateDifficulty: '容易成交',
      rateTierNote: '符合初中阶段建议区间 (¥100-180/h)',
      scoreHighlight: '高考理综278分 · 物理满分110',
      styles: ['基础漏洞重构', '错题本高效提分法'],
      proofFiles: [
        { name: '大学物理全满绩截图证明.jpg', size: '1.9MB', verified: true },
        { name: '国家奖学金荣誉证书.pdf', size: '1.1MB', verified: true }
      ],
      lectureUrl: 'https://pan.quark.cn/s/demoQuarkPhysics882',
      status: 'approved',
      submitTime: '2026-09-09 19:40',
      evalGrade: 'V1 级标准导师',
      reviewComment: '物理力学受力分析拆解细致，适合初中提优补弱学员。',
      spacePreference: '高新大源中央微网点'
    },
    {
      id: 'AP-8803',
      code: 'CD-2026-8811',
      realName: '王艺霖',
      phone: '15928114422',
      idCard: '510105200409201144',
      university: '西南交通大学',
      province: '四川',
      degree: '本科在读 (大二)',
      chsiCode: 'C33K9911OP231908',
      chsiStatus: '有效 (在籍)',
      chsiMajor: '外国语学院英语专业 · 英语专业四级优秀',
      publicTeacherCompliance: true,
      subjects: ['小学英语', '初中英语', '考研英语(一/二)'],
      customSubjects: ['雅思托福口语备考'],
      hourlyRate: 120,
      rateDifficulty: '容易成交',
      rateTierNote: '符合初中/考研英语建议区间 (¥100-180/h)',
      scoreHighlight: '高考英语146分 · 全国大学生英语竞赛特等奖',
      styles: ['引导启发解题', '耐心督学陪读'],
      proofFiles: [
        { name: '全国大学生英语竞赛NECCS特等奖.pdf', size: '2.8MB', verified: true },
        { name: '专四TEM4优秀证书.jpg', size: '1.6MB', verified: true }
      ],
      lectureUrl: 'https://www.bilibili.com/video/BV1demoEnglishLecture',
      status: 'approved',
      submitTime: '2026-09-09 20:15',
      evalGrade: 'V2 级金牌导师',
      reviewComment: '发音地道，中考阅读长难句结构归纳能力优秀。',
      spacePreference: '青羊金沙文化微网点'
    },
    {
      id: 'AP-8804',
      code: 'CD-2026-8812',
      realName: '赵文博',
      phone: '17780556633',
      idCard: '510108200111037722',
      university: '西南财经大学',
      province: '四川',
      degree: '全日制本科毕业生',
      chsiCode: 'D77Y5500QR998811',
      chsiStatus: '有效 (已毕业)',
      chsiMajor: '金融学专业 · 经济学学士',
      publicTeacherCompliance: true,
      subjects: ['考研数学(一/二/三)', '高中数学'],
      customSubjects: [],
      hourlyRate: 190,
      rateDifficulty: '容易成交',
      rateTierNote: '符合考研数学建议区间 (¥150-280/h)',
      scoreHighlight: '考研数学三142分',
      styles: ['大题压轴模型归纳', '解题技巧与大题模型'],
      proofFiles: [
        { name: '研究生初试成绩单与数学单科证明.jpg', size: '2.3MB', verified: true }
      ],
      lectureUrl: 'https://pan.baidu.com/s/1mathLectureZwb',
      status: 'approved',
      submitTime: '2026-09-09 21:05',
      evalGrade: 'V2 级金牌导师',
      reviewComment: '高等数学微积分极限证明思路开阔，建议重点对接考研数学需求。',
      spacePreference: '武侯川大望江微网点'
    },
    {
      id: 'AP-8805',
      code: 'CD-2026-8798',
      realName: '陈梓涵',
      phone: '13540001199',
      idCard: '510106200204185566',
      university: '四川师范大学',
      province: '四川',
      degree: '本科在读 (大四)',
      chsiCode: 'E88U1122AA443322',
      chsiStatus: '有效 (在籍)',
      chsiMajor: '汉语言文学 (师范方向)',
      publicTeacherCompliance: true,
      subjects: ['初中语文', '高中语文'],
      customSubjects: [],
      hourlyRate: 130,
      rateDifficulty: '容易成交',
      rateTierNote: '符合初高中语文区间',
      scoreHighlight: '语文高考133分 · 作文特等奖',
      styles: ['引导启发解题', '错题本高效提分法'],
      proofFiles: [
        { name: '初中高级中学教师资格考试合格证明.pdf', size: '1.5MB', verified: true }
      ],
      lectureUrl: 'https://pan.quark.cn/s/chineseDemoCzh',
      status: 'approved',
      submitTime: '2026-09-08 14:10',
      evalGrade: 'V2 级金牌导师',
      reviewComment: '古文阅读断句及主旨升华讲练得当，已授予工牌。',
      spacePreference: '武侯川大望江微网点'
    },
    {
      id: 'AP-8806',
      code: 'CD-2026-8772',
      realName: '孙浩然',
      phone: '18980889922',
      idCard: '510109200301298811',
      university: '成都理工大学',
      province: '四川',
      degree: '本科在读 (大二)',
      chsiCode: 'F99P4433BB776655',
      chsiStatus: '待复核 (查询超时)',
      chsiMajor: '地质工程专业',
      publicTeacherCompliance: true,
      subjects: ['小学数学', '小学奥数思维'],
      customSubjects: [],
      hourlyRate: 90,
      rateDifficulty: '容易成交',
      rateTierNote: '符合小学阶段 (¥70-100/h)',
      scoreHighlight: '高考数学128分',
      styles: ['耐心督学陪读'],
      proofFiles: [],
      lectureUrl: 'https://pan.baidu.com/s/demoBlank',
      status: 'supplement',
      submitTime: '2026-09-08 16:30',
      evalGrade: '待复评',
      reviewComment: '未上传在校成绩单或高考分数佐证截图，试讲网盘链接失效，需补交。',
      spacePreference: '高新大源中央微网点'
    },
    {
      id: 'AP-8807',
      code: 'CD-2026-8750',
      realName: '周敏',
      phone: '13980005544',
      idCard: '510103199807124433',
      university: '成都大学',
      province: '四川',
      degree: '全日制本科毕业生',
      chsiCode: 'G11T7788CC990011',
      chsiStatus: '有效',
      chsiMajor: '教育学',
      publicTeacherCompliance: false,
      subjects: ['初中化学', '高中化学'],
      customSubjects: [],
      hourlyRate: 260,
      rateDifficulty: '成交较难',
      rateTierNote: '严重溢价且存在公办校在编任教记录',
      scoreHighlight: '十年中考化学教龄 (存在红线嫌疑)',
      styles: ['大题压轴模型归纳'],
      proofFiles: [
        { name: '某区重点中学聘书截图.jpg', size: '1.2MB', verified: false }
      ],
      lectureUrl: 'https://pan.baidu.com/s/demoTeacherSchool',
      status: 'rejected',
      submitTime: '2026-09-07 10:12',
      evalGrade: '不予评级',
      reviewComment: '排查发现系公立在职合同聘任教师，违反教育部双减合规红线，一票否决拉黑。',
      spacePreference: '青羊金沙文化微网点'
    },
    {
      id: 'AP-8808',
      code: 'CD-2026-8820',
      realName: '周晓梦',
      phone: '13688006655',
      idCard: '510107200112088866',
      university: '四川音乐学院 / 四川大学',
      province: '四川',
      degree: '音乐学与通识辅修',
      chsiCode: 'H22M3344DD556677',
      chsiStatus: '有效 (在籍)',
      chsiMajor: '音乐学 · 艺考文化课辅修',
      publicTeacherCompliance: true,
      subjects: ['美术/音乐艺考文化课', '语文', '英语'],
      customSubjects: ['艺考文化课冲刺'],
      hourlyRate: 140,
      rateDifficulty: '容易成交',
      rateTierNote: '符合艺考文化课建议区间',
      scoreHighlight: '艺考文化课百日提分120分实战经验',
      styles: ['考前心态疏导', '高频基础分扫盲', '碎片时间提分法'],
      proofFiles: [
        { name: '艺考文化课提分案例集.pdf', size: '2.0MB', verified: true }
      ],
      lectureUrl: 'https://pan.baidu.com/s/demoArtExamCulture',
      status: 'approved',
      submitTime: '2026-09-08 11:20',
      evalGrade: 'V2 级金牌导师',
      reviewComment: '艺考文化课提分路径清晰，适合冲刺学员。',
      spacePreference: '武侯川大望江微网点'
    }
  ];
}

function getSeedParent() {
  return {
    id: 'PAR-DEMO-001',
    parentName: '刘女士',
    parentRole: '妈妈',
    phone: '13980889211',
    studentNickname: '乐乐同学',
    studentGrade: '初三 (中考冲刺)',
    cityDistrict: '青羊区',
    subjects: ['数学', '物理'],
    subjectPlans: {
      '数学': {
        weakPoints: [
          '二次函数图象性质与最值求法',
          '圆的切线性质与辅助线综合证明'
        ],
        pacing: '查缺补漏 · 阶段单元复盘',
        pains: ['畏难情绪遇压轴就慌', '粗心漏题做题慢']
      },
      '物理': {
        weakPoints: [
          '动态电路欧姆定律综合计算',
          '电功率比值与电热极值分析'
        ],
        pacing: '紧贴校内进度 · 随堂查漏补缺',
        pains: ['概念模糊公式乱用']
      }
    },
    syllabusTopics: [
      '二次函数图象性质与最值求法',
      '圆的切线性质与辅助线综合证明',
      '动态电路欧姆定律综合计算',
      '电功率比值与电热极值分析'
    ],
    pacingMode: '查缺补漏 · 阶段单元复盘',
    budgetMin: 100,
    budgetMax: 160,
    budgetRate: 130,
    selectedSpace: '青羊金沙文化微网点',
    targetGoal: '希望在中考前加强几何综合证明与函数动点题型，每周在青羊金沙仓系统巩固。',
    painTags: ['畏难情绪遇压轴就慌', '粗心漏题做题慢', '概念模糊公式乱用'],
    createdAt: '2026-09-10 09:00',
    updatedAt: '2026-09-10 09:00'
  };
}

function emptySnapshot() {
  return {
    mentors: getSeedMentors().map(withMentorDefaults),
    parents: [getSeedParent()],
    bookings: getSeedBookings(),
    contracts: [],
    session: null,
    seeded: true
  };
}

let state = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function persist() {
  ensureDir();
  const json = JSON.stringify(state, null, 2);
  fs.writeFileSync(TMP_PATH, json, 'utf8');
  fs.renameSync(TMP_PATH, DB_PATH);
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    state = emptySnapshot();
    persist();
    return state;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    state = JSON.parse(raw);
    if (!state.mentors) state.mentors = [];
    if (!state.parents) state.parents = [];
    if (!state.bookings) state.bookings = [];
    if (!state.contracts) state.contracts = [];
    if (state.seeded == null) state.seeded = true;
    // patch mentor defaults
    let need = false;
    state.mentors = state.mentors.map((m) => {
      if (!m.availableSlots || !m.availableSlots.length || !m.preferredSpaces) {
        need = true;
        return withMentorDefaults(m);
      }
      return m;
    });
    if (need) persist();
  } catch (e) {
    console.warn('[db] load fail, reseed', e.message);
    state = emptySnapshot();
    persist();
  }
  return state;
}

function getState() {
  if (!state) load();
  return state;
}

function snapshot() {
  const s = getState();
  return {
    mentors: s.mentors.slice(),
    parents: s.parents.slice(),
    bookings: s.bookings.slice(),
    contracts: (s.contracts || []).slice(),
    session: s.session ? Object.assign({}, s.session) : null,
    seeded: !!s.seeded
  };
}

function replaceSnapshot(body) {
  const s = getState();
  if (body.mentors) s.mentors = body.mentors.map(withMentorDefaults);
  if (body.parents) s.parents = body.parents;
  if (body.bookings) s.bookings = body.bookings;
  if (body.contracts) s.contracts = body.contracts;
  if (body.session !== undefined) s.session = body.session;
  if (body.seeded !== undefined) s.seeded = !!body.seeded;
  persist();
  return snapshot();
}

function reset() {
  state = emptySnapshot();
  persist();
  return snapshot();
}

function seedIfEmpty() {
  const s = getState();
  let changed = false;
  if (!s.mentors || !s.mentors.length) {
    s.mentors = getSeedMentors().map(withMentorDefaults);
    changed = true;
  } else {
    const patched = s.mentors.map((m) => {
      if (!m.availableSlots || !m.availableSlots.length || !m.preferredSpaces) {
        changed = true;
        return withMentorDefaults(m);
      }
      return m;
    });
    s.mentors = patched;
  }
  if (!s.parents || !s.parents.length) {
    s.parents = [getSeedParent()];
    changed = true;
  }
  if (!s.bookings || !s.bookings.length) {
    s.bookings = getSeedBookings();
    changed = true;
  }
  if (!s.seeded) {
    s.seeded = true;
    changed = true;
  }
  if (changed) persist();
  return snapshot();
}

/* ---------- Mentors ---------- */
function getMentors() {
  return getState().mentors.slice();
}

function getMentorById(id) {
  return getState().mentors.find((m) => m.id === id) || null;
}

function getMentorByPhone(phone) {
  if (!phone) return null;
  const p = String(phone).trim();
  return getState().mentors.find((m) => m.phone && String(m.phone).trim() === p) || null;
}

function addMentor(mentor) {
  const s = getState();
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
    mentor || {}
  );
  const normalized = withMentorDefaults(record);
  s.mentors.unshift(normalized);
  const session = s.session || {};
  session.role = 'mentor';
  session.mentorId = normalized.id;
  session.phone = normalized.phone || session.phone;
  s.session = session;
  persist();
  return normalized;
}

function updateMentor(id, patch, options) {
  const s = getState();
  const idx = s.mentors.findIndex((m) => m.id === id);
  if (idx < 0) return null;
  const opts = options || {};
  const next = Object.assign({}, s.mentors[idx], patch || {}, { updatedAt: _now() });
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
  s.mentors[idx] = withMentorDefaults(next);
  persist();
  return s.mentors[idx];
}

/* ---------- Parents ---------- */
function normalizeParentProfile(p) {
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
      out.subjects.forEach(function (subj, i) {
        out.subjectPlans[subj] = {
          weakPoints: i === 0 ? topics.slice() : [],
          pacing: pacing,
          pains: i === 0 ? pains.slice() : []
        };
      });
    }
  }
  if (!Array.isArray(out.syllabusTopics)) {
    const flat = [];
    Object.keys(out.subjectPlans).forEach(function (subj) {
      (out.subjectPlans[subj].weakPoints || []).forEach(function (t) {
        if (flat.indexOf(t) < 0) flat.push(t);
      });
    });
    out.syllabusTopics = flat;
  }
  if (!Array.isArray(out.painTags)) {
    const flat = [];
    Object.keys(out.subjectPlans).forEach(function (subj) {
      (out.subjectPlans[subj].pains || []).forEach(function (t) {
        if (flat.indexOf(t) < 0) flat.push(t);
      });
    });
    out.painTags = flat;
  }
  return out;
}

function getParents() {
  return getState().parents.slice();
}

function getParentByPhone(phone) {
  if (!phone) return null;
  const p = String(phone).trim();
  const found = getState().parents.find((x) => x.phone && String(x.phone).trim() === p);
  return found ? normalizeParentProfile(found) : null;
}

function saveParent(profile) {
  const s = getState();
  const incoming = normalizeParentProfile(profile || {}) || {};
  let idx = -1;
  if (incoming.id) {
    idx = s.parents.findIndex((p) => p.id === incoming.id);
  }
  if (idx < 0 && incoming.phone) {
    const phone = String(incoming.phone).trim();
    idx = s.parents.findIndex((p) => p.phone && String(p.phone).trim() === phone);
  }
  const record = Object.assign(
    {
      id: (idx >= 0 && s.parents[idx].id) || incoming.id || _uid('PAR'),
      createdAt: (idx >= 0 && s.parents[idx].createdAt) || _now()
    },
    incoming,
    { updatedAt: _now() }
  );
  if (idx >= 0) {
    record.id = s.parents[idx].id;
    record.createdAt = s.parents[idx].createdAt || record.createdAt;
    s.parents[idx] = record;
  } else {
    s.parents.unshift(record);
  }
  const session = s.session || {};
  session.role = 'parent';
  session.parentId = record.id;
  session.phone = record.phone;
  s.session = session;
  persist();
  return record;
}

/* ---------- Bookings ---------- */
function getBookings() {
  return getState().bookings.slice();
}

function addBooking(booking) {
  const s = getState();
  const mentorId = (booking && (booking.mentorId || booking.tutorId)) || '';
  const record = Object.assign(
    {
      id: _uid('BK'),
      createdAt: _now(),
      status: 'pending_accept',
      declineReason: '',
      mentorId: mentorId,
      tutorId: mentorId,
      type: (booking && booking.type) || 'one_off',
      sessions: (booking && booking.sessions) || [],
      escrowStatus: (booking && booking.escrowStatus) || 'frozen'
    },
    booking || {},
    {
      mentorId: mentorId || (booking && booking.mentorId) || '',
      tutorId: mentorId || (booking && (booking.tutorId || booking.mentorId)) || ''
    }
  );
  s.bookings.unshift(record);
  persist();
  return record;
}

function updateBooking(id, patch) {
  const s = getState();
  const idx = s.bookings.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  s.bookings[idx] = Object.assign({}, s.bookings[idx], patch || {}, { updatedAt: _now() });
  persist();
  return s.bookings[idx];
}

function respondToBooking(id, decision) {
  const s = getState();
  const idx = s.bookings.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  const d = decision || {};
  const accept = d.accept === true || d.action === 'accept';
  const decline = d.accept === false || d.decline === true || d.action === 'decline';
  if (accept) {
    s.bookings[idx] = Object.assign({}, s.bookings[idx], {
      status: 'accepted',
      declineReason: '',
      respondedAt: _now()
    });
  } else if (decline) {
    s.bookings[idx] = Object.assign({}, s.bookings[idx], {
      status: 'declined',
      declineReason: d.reason || d.declineReason || '导师暂时无法承接此时段',
      respondedAt: _now()
    });
  } else {
    return s.bookings[idx];
  }
  persist();
  return s.bookings[idx];
}


/* ---------- Weekly leave / escrow helpers ---------- */
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function buildWeeklySessions(weekday, timeStart, hours, sessionCount, startDateStr) {
  const count = Math.max(1, Math.min(24, parseInt(sessionCount, 10) || 4));
  const wd = parseInt(weekday, 10);
  const h = Math.max(1, parseInt(hours, 10) || 2);
  const [sh, sm] = String(timeStart || '19:00').split(':').map(Number);
  let cursor = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
  cursor.setHours(0, 0, 0, 0);
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
        weekdayLabel: WEEKDAY_LABELS[wd] || '',
        timeStart: timeStart || '19:00',
        timeEnd: timeEnd,
        timeLabel: String(timeStart || '19:00') + '-' + timeEnd,
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
}

function requestSessionLeave(bookingId, sessionId, byRole) {
  const s = getState();
  const idx = s.bookings.findIndex((b) => b.id === bookingId);
  if (idx < 0) return { ok: false, error: '约课不存在' };
  const booking = Object.assign({}, s.bookings[idx]);
  if (!Array.isArray(booking.sessions)) booking.sessions = [];
  const sIdx = booking.sessions.findIndex((x) => x.id === sessionId);
  if (sIdx < 0) return { ok: false, error: '课次不存在' };
  const session = Object.assign({}, booking.sessions[sIdx]);
  if (session.status === 'leave_approved' || session.status === 'cancelled') {
    return { ok: false, error: '该课次已请假或已取消' };
  }
  if (session.status === 'completed') {
    return { ok: false, error: '已完成课次不可请假' };
  }
  const now = new Date();
  let tooLate = false;
  if (session.date && session.timeStart) {
    const [hh, mm] = String(session.timeStart).split(':').map(Number);
    const start = new Date(session.date + 'T00:00:00');
    start.setHours(hh || 0, mm || 0, 0, 0);
    if (start.getTime() - now.getTime() < 24 * 3600 * 1000) tooLate = true;
  }
  if (tooLate) {
    session.status = 'leave_too_late';
    booking.sessions[sIdx] = session;
    s.bookings[idx] = Object.assign({}, booking, { updatedAt: _now() });
    persist();
    return { ok: false, error: '请假须提前一日确认（开课前满 24 小时）', tooLate: true, booking: s.bookings[idx] };
  }
  session.status = 'leave_pending';
  session.leaveRequestedAt = _now();
  session.leaveRequestedBy = byRole || 'parent';
  booking.sessions[sIdx] = session;
  s.bookings[idx] = Object.assign({}, booking, { updatedAt: _now() });
  persist();
  return { ok: true, booking: s.bookings[idx], session: session };
}

function confirmSessionLeave(bookingId, sessionId, approve) {
  const s = getState();
  const idx = s.bookings.findIndex((b) => b.id === bookingId);
  if (idx < 0) return { ok: false, error: '约课不存在' };
  const booking = Object.assign({}, s.bookings[idx]);
  if (!Array.isArray(booking.sessions)) return { ok: false, error: '无课次' };
  const sIdx = booking.sessions.findIndex((x) => x.id === sessionId);
  if (sIdx < 0) return { ok: false, error: '课次不存在' };
  const session = Object.assign({}, booking.sessions[sIdx]);
  if (approve === false) {
    session.status = 'scheduled';
    session.leaveRequestedAt = '';
    session.leaveRequestedBy = '';
  } else {
    const now = new Date();
    if (session.date && session.timeStart) {
      const [hh, mm] = String(session.timeStart).split(':').map(Number);
      const start = new Date(session.date + 'T00:00:00');
      start.setHours(hh || 0, mm || 0, 0, 0);
      if (start.getTime() - now.getTime() < 24 * 3600 * 1000) {
        session.status = 'leave_too_late';
        booking.sessions[sIdx] = session;
        s.bookings[idx] = Object.assign({}, booking, { updatedAt: _now() });
        persist();
        return { ok: false, error: '已不足提前一日，无法批准请假', tooLate: true, booking: s.bookings[idx] };
      }
    }
    session.status = 'leave_approved';
    session.leaveConfirmedAt = _now();
    session.escrowStatus = 'released';
  }
  booking.sessions[sIdx] = session;
  s.bookings[idx] = Object.assign({}, booking, { updatedAt: _now() });
  persist();
  return { ok: true, booking: s.bookings[idx], session: session };
}

function normalizeClassSummary(summary, mentorId) {
  if (summary == null || summary === '') return null;
  if (typeof summary === 'string') {
    return { title: '', content: summary, tags: [], createdAt: _now(), mentorId: mentorId || '' };
  }
  return {
    title: summary.title || '',
    content: summary.content || summary.body || '',
    tags: Array.isArray(summary.tags) ? summary.tags.slice() : [],
    createdAt: summary.createdAt || _now(),
    mentorId: summary.mentorId || mentorId || ''
  };
}

function completeSession(bookingId, sessionId, meta) {
  const opts = meta || {};
  const s = getState();
  const idx = s.bookings.findIndex((b) => b.id === bookingId);
  if (idx < 0) return { ok: false, error: '约课不存在' };
  const booking = Object.assign({}, s.bookings[idx]);
  if (!Array.isArray(booking.sessions)) booking.sessions = [];
  const sIdx = booking.sessions.findIndex((x) => x.id === sessionId);
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
    session.classSummary = normalizeClassSummary(opts.classSummary, opts.mentorId || booking.mentorId);
  }
  booking.sessions[sIdx] = session;
  if (booking.type === 'one_off' || booking.sessions.length === 1) {
    booking.completedAt = session.completedAt;
  }
  s.bookings[idx] = Object.assign({}, booking, { updatedAt: _now() });
  persist();
  return { ok: true, booking: s.bookings[idx], session: session };
}

function saveClassSummary(bookingId, sessionId, summary, mentorId) {
  const s = getState();
  const idx = s.bookings.findIndex((b) => b.id === bookingId);
  if (idx < 0) return { ok: false, error: '约课不存在' };
  const booking = Object.assign({}, s.bookings[idx]);
  if (!Array.isArray(booking.sessions)) return { ok: false, error: '无课次' };
  const sIdx = booking.sessions.findIndex((x) => x.id === sessionId);
  if (sIdx < 0) return { ok: false, error: '课次不存在' };
  const session = Object.assign({}, booking.sessions[sIdx]);
  const normalized = normalizeClassSummary(summary, mentorId || booking.mentorId);
  if (!normalized || !String(normalized.content || '').trim()) {
    return { ok: false, error: '请填写课后小结内容' };
  }
  session.classSummary = normalized;
  booking.sessions[sIdx] = session;
  s.bookings[idx] = Object.assign({}, booking, { updatedAt: _now() });
  persist();
  return { ok: true, booking: s.bookings[idx], session: session };
}

function setMentorAvailability(mentorId, availability) {
  const normalized = (availability || []).map((item) => ({
    weekday: parseInt(item.weekday, 10),
    ranges: (item.ranges || []).map((r) => ({ start: r.start, end: r.end })).filter((r) => r.start && r.end)
  })).filter((item) => !isNaN(item.weekday) && item.ranges.length);
  const slots = availabilityToSlotLabels(normalized);
  return updateMentor(mentorId, {
    availability: normalized,
    availableSlots: slots
  }, {});
}

function processEscrowReleases() {
  const s = getState();
  let changed = false;
  const now = new Date();
  s.bookings.forEach((b, bi) => {
    if (!Array.isArray(b.sessions)) return;
    let sessChanged = false;
    const sessions = b.sessions.map((sess) => {
      if (sess.status === 'completed' && sess.escrowStatus === 'frozen' && sess.releaseAt) {
        const t = new Date(String(sess.releaseAt).replace(' ', 'T'));
        if (!isNaN(t.getTime()) && now >= t) {
          sessChanged = true;
          changed = true;
          return Object.assign({}, sess, { escrowStatus: 'released' });
        }
      }
      return sess;
    });
    if (sessChanged) {
      s.bookings[bi] = Object.assign({}, b, { sessions: sessions, updatedAt: _now() });
    }
  });
  if (changed) persist();
  return s.bookings.slice();
}


/* ---------- Contracts ---------- */
function getContracts() {
  return (getState().contracts || []).slice();
}

function saveContract(contract) {
  const s = getState();
  if (!s.contracts) s.contracts = [];
  const record = Object.assign({ id: _uid('CT'), signedAt: _now() }, contract || {});
  s.contracts.unshift(record);
  persist();
  return record;
}

/* ---------- Session ---------- */
function getSession() {
  return getState().session;
}

function setSession(session) {
  const s = getState();
  s.session = session || {};
  persist();
  return s.session;
}

/* ---------- Matching ---------- */
function subjectOverlap(mentorSubjects, parentSubjects) {
  if (!parentSubjects || parentSubjects.length === 0) return 0.5;
  const ms = (mentorSubjects || []).map((x) => String(x).toLowerCase());
  let hits = 0;
  parentSubjects.forEach((ps) => {
    const p = String(ps).toLowerCase();
    if (ms.some((m) => m.includes(p) || p.includes(m.replace(/初中|高中|小学|考研/g, '')))) {
      hits += 1;
    }
  });
  return hits / parentSubjects.length;
}

function mentorToTutorCard(mentor, parentProfile) {
  const surname = (mentor.realName || '导').charAt(0);
  const subjects = [].concat(mentor.subjects || [], mentor.customSubjects || []);
  const parentNorm = normalizeParentProfile(parentProfile || {}) || {};
  const parentSubjects = parentNorm.subjects || [];
  let parentTopics = parentNorm.syllabusTopics || [];
  if ((!parentTopics || !parentTopics.length) && parentNorm.subjectPlans) {
    parentTopics = [];
    Object.keys(parentNorm.subjectPlans).forEach(function (subj) {
      (parentNorm.subjectPlans[subj].weakPoints || []).forEach(function (t) {
        if (parentTopics.indexOf(t) < 0) parentTopics.push(t);
      });
    });
  }
  const budgetMin = Number(parentNorm.budgetMin) || 80;
  const budgetMax = Number(parentNorm.budgetMax) || 180;
  const budget = Number(parentNorm.budgetRate) || Math.round((budgetMin + budgetMax) / 2);
  const preferredSpace = parentNorm.selectedSpace || mentor.spacePreference || '青羊金沙文化微网点';
  const rate = Number(mentor.hourlyRate) || 120;

  const overlap = subjectOverlap(subjects, parentSubjects);
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
    evalGrade: mentor.evalGrade || 'V2 级金牌导师'
  };
}

function matchTutors(parentProfile) {
  seedIfEmpty();
  const parent = parentProfile || getState().parents[0] || getSeedParent();
  const approved = getState().mentors.filter((m) => m.status === 'approved');
  let tutors = approved.map((m) => mentorToTutorCard(m, parent));
  tutors.sort((a, b) => b.matchScore - a.matchScore);
  if (tutors.length === 0) {
    seedIfEmpty();
    tutors = getState()
      .mentors.filter((m) => m.status === 'approved')
      .map((m) => mentorToTutorCard(m, parent));
    tutors.sort((a, b) => b.matchScore - a.matchScore);
  }
  return tutors;
}

// init on require
load();

module.exports = {
  DEFAULT_SLOTS,
  SPACE_OPTIONS,
  DB_PATH,
  load,
  snapshot,
  replaceSnapshot,
  reset,
  seedIfEmpty,
  getMentors,
  getMentorById,
  getMentorByPhone,
  addMentor,
  updateMentor,
  getParents,
  getParentByPhone,
  saveParent,
  normalizeParentProfile,
  getBookings,
  addBooking,
  updateBooking,
  respondToBooking,
  buildWeeklySessions,
  requestSessionLeave,
  confirmSessionLeave,
  completeSession,
  saveClassSummary,
  setMentorAvailability,
  processEscrowReleases,
  getContracts,
  saveContract,
  getSession,
  setSession,
  matchTutors,
  withMentorDefaults,
  availabilityToSlotLabels,
  parseSlotLabelToAvailability
};
