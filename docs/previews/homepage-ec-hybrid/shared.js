/* 星火伴学 · 翻简历首页 · 共享数据与登录墙 */
window.XH = window.XH || {};

XH.MENTORS = [
  {
    id: "m1",
    surname: "张",
    initial: "张",
    displayName: "张同学",
    school: "电子科大",
    schoolFull: "电子科技大学",
    major: "数学与应用数学",
    subjects: ["考研数学", "高中数学"],
    grades: ["高中", "考研"],
    priceMin: 120, priceMax: 150,
    priceBand: "¥120–150/时",
    tags: ["竞赛背景", "讲题清晰"],
    highlight: "考研数一 140+，擅长帮助基础薄弱同学建立框架。",
    bio: "大四在读，辅导考研数学两年。习惯先诊断薄弱点，再按周拆解刷题节奏。课堂节奏稳，板书清晰。",
    slots: ["周三晚", "周五晚", "周六上午"],
    site: "金沙教学点",
    rating: 4.97, reviews: 86,
    matchHint: "科目完全匹配 · 晚间可约",
    color: "#0d9488",
    nearby: true, featured: true, highRate: true
  },
  {
    id: "m2",
    surname: "李",
    initial: "李",
    displayName: "李同学",
    school: "四川大学",
    schoolFull: "四川大学",
    major: "英语",
    subjects: ["初中英语", "高中英语"],
    grades: ["初中", "高中"],
    priceMin: 90, priceMax: 120,
    priceBand: "¥90–120/时",
    tags: ["口语强", "耐心细致"],
    highlight: "专四优秀，擅长用情境对话帮初高中生开口说英语。",
    bio: "英语专业，有一年线下一对一经验。侧重听说与阅读理解，作业反馈及时。",
    slots: ["周二晚", "周四晚", "周日下午"],
    site: "东门教学点",
    rating: 4.92, reviews: 64,
    matchHint: "年级匹配 · 周末有空档",
    color: "#14b8a6",
    nearby: true, featured: false, highRate: true
  },
  {
    id: "m3",
    surname: "王",
    initial: "王",
    displayName: "王同学",
    school: "西南交大",
    schoolFull: "西南交通大学",
    major: "物理学",
    subjects: ["高中物理", "初中物理"],
    grades: ["初中", "高中"],
    priceMin: 100, priceMax: 130,
    priceBand: "¥100–130/时",
    tags: ["实验辅导", "压轴题"],
    highlight: "物理竞赛省二，擅长把抽象概念讲成日常类比。",
    bio: "工科背景，辅导高一高二物理为主。会带简易演示，帮助理解受力与电路。",
    slots: ["周一晚", "周六全天"],
    site: "犀浦教学点",
    rating: 4.88, reviews: 41,
    matchHint: "学科匹配 · 周六可约整段",
    color: "#0f766e",
    nearby: false, featured: true, highRate: false
  },
  {
    id: "m4",
    surname: "陈",
    initial: "陈",
    displayName: "陈同学",
    school: "川大",
    schoolFull: "四川大学",
    major: "汉语言文学",
    subjects: ["小学语文", "作文专项"],
    grades: ["小学", "初中"],
    priceMin: 80, priceMax: 100,
    priceBand: "¥80–100/时",
    tags: ["作文批改", "阅读积累"],
    highlight: "擅长小学中高年级作文，一周一稿精细批改。",
    bio: "中文系大三，带过托管班作文课。注重素材积累与结构训练，家长反馈进步明显。",
    slots: ["周三下午", "周六上午", "周日上午"],
    site: "金沙教学点",
    rating: 4.95, reviews: 112,
    matchHint: "价位友好 · 周末上午可约",
    color: "#115e59",
    nearby: true, featured: false, highRate: true
  },
  {
    id: "m5",
    surname: "赵",
    initial: "赵",
    displayName: "赵同学",
    school: "电子科大",
    schoolFull: "电子科技大学",
    major: "计算机",
    subjects: ["信息学奥赛", "Python入门"],
    grades: ["初中", "高中"],
    priceMin: 130, priceMax: 160,
    priceBand: "¥130–160/时",
    tags: ["NOIP", "项目实战"],
    highlight: "NOIP 提高组，带学生从零到省一的完整路径。",
    bio: "计科大三，教练助理一年。课程含算法基础 + 每周 OJ 作业讲评。",
    slots: ["周五晚", "周日全天"],
    site: "线上优先",
    rating: 4.90, reviews: 28,
    matchHint: "专项匹配 · 周日可长时段",
    color: "#134e4a",
    nearby: false, featured: true, highRate: true
  },
  {
    id: "m6",
    surname: "刘",
    initial: "刘",
    displayName: "刘同学",
    school: "四川音乐学院",
    schoolFull: "四川音乐学院",
    major: "钢琴表演",
    subjects: ["艺体·钢琴", "艺考陪练", "音乐"],
    grades: ["小学", "初中", "高中", "艺体"],
    priceMin: 110, priceMax: 140,
    priceBand: "¥110–140/时",
    tags: ["艺考", "考级辅导"],
    highlight: "钢琴十级，擅长考级与艺考陪练，课堂轻松有趣。",
    bio: "大二在读，有三年家教经验。可上门或教学点琴房，注重基本功与曲目选择。",
    slots: ["周六下午", "周日下午"],
    site: "东门教学点",
    rating: 4.94, reviews: 53,
    matchHint: "艺体专项 · 周末下午",
    color: "#0d9488",
    nearby: true, featured: false, highRate: true
  },
  {
    id: "m7",
    surname: "周",
    initial: "周",
    displayName: "周同学",
    school: "西南财大",
    schoolFull: "西南财经大学",
    major: "统计学",
    subjects: ["考研数学", "高中数学"],
    grades: ["高中", "考研"],
    priceMin: 100, priceMax: 135,
    priceBand: "¥100–135/时",
    tags: ["概率统计", "真题精讲"],
    highlight: "统计学专业，考研数学辅导侧重概率与线代。",
    bio: "研一，已带三届考研学生。课堂以真题为主线，配周测巩固。",
    slots: ["周二晚", "周四晚", "周六晚"],
    site: "光华教学点",
    rating: 4.85, reviews: 37,
    matchHint: "考研向 · 晚间连续可约",
    color: "#14b8a6",
    nearby: false, featured: false, highRate: false
  },
  {
    id: "m8",
    surname: "吴",
    initial: "吴",
    displayName: "吴同学",
    school: "川大",
    schoolFull: "四川大学",
    major: "化学",
    subjects: ["高中化学", "初中化学"],
    grades: ["初中", "高中"],
    priceMin: 95, priceMax: 125,
    priceBand: "¥95–125/时",
    tags: ["方程式", "实验安全"],
    highlight: "化学竞赛省三，讲解方程式与实验题条分缕析。",
    bio: "化学系大三。善于用思维导图整理元素与反应类型，适合中考/高考冲刺。",
    slots: ["周一晚", "周三晚", "周五晚"],
    site: "望江教学点",
    rating: 4.91, reviews: 49,
    matchHint: "工作日晚间可约 · 近望江",
    color: "#0f766e",
    nearby: true, featured: true, highRate: true
  },
  {
    id: "m9",
    surname: "孙",
    initial: "孙",
    displayName: "孙同学",
    school: "川师大",
    schoolFull: "四川师范大学",
    major: "小学教育",
    subjects: ["小学数学", "小学英语"],
    grades: ["小学"],
    priceMin: 70, priceMax: 95,
    priceBand: "¥70–95/时",
    tags: ["基础夯实", "家校沟通"],
    highlight: "师范背景，擅长小学数学启蒙与英语兴趣培养。",
    bio: "小学教育大三，有一年托管班经验。课堂活泼，注重习惯养成。",
    slots: ["周三下午", "周六上午", "周日上午"],
    site: "金沙教学点",
    rating: 4.93, reviews: 71,
    matchHint: "小学全科友好 · 周末上午",
    color: "#0d9488",
    nearby: true, featured: true, highRate: true
  },
  {
    id: "m10",
    surname: "郑",
    initial: "郑",
    displayName: "郑同学",
    school: "川大",
    schoolFull: "四川大学",
    major: "马克思主义理论",
    subjects: ["考研英语", "考研政治"],
    grades: ["考研"],
    priceMin: 110, priceMax: 140,
    priceBand: "¥110–140/时",
    tags: ["真题精讲", "时政梳理"],
    highlight: "考研英一 80+、政治 75+，擅长长难句与时政热点。",
    bio: "研二，带过两届考研学生。英语侧重阅读与写作模板，政治按题型拆解。",
    slots: ["周一晚", "周四晚", "周日晚"],
    site: "望江教学点",
    rating: 4.89, reviews: 33,
    matchHint: "考研公共课 · 晚间可约",
    color: "#115e59",
    nearby: true, featured: false, highRate: false
  },
  {
    id: "m11",
    surname: "何",
    initial: "何",
    displayName: "何同学",
    school: "四川美术学院",
    schoolFull: "四川美术学院",
    major: "美术学",
    subjects: ["美术", "艺考陪练"],
    grades: ["小学", "初中", "高中", "艺体"],
    priceMin: 100, priceMax: 130,
    priceBand: "¥100–130/时",
    tags: ["素描", "色彩"],
    highlight: "美院在读，擅长素描色彩与中小学美术兴趣课。",
    bio: "大三，有艺考集训助教经验。可教学点画室或线上示范。",
    slots: ["周六全天", "周日下午"],
    site: "东门教学点",
    rating: 4.91, reviews: 22,
    matchHint: "艺体·美术 · 周末可约",
    color: "#14b8a6",
    nearby: true, featured: true, highRate: true
  }
];

XH.SUBJECTS = ["全部", "考研数学", "高中数学", "高中物理", "高中化学", "初中英语", "高中英语", "小学语文", "作文专项", "信息学奥赛", "艺体·钢琴"];
XH.GRADES = ["全部", "小学", "初中", "高中", "考研", "艺体"];
XH.TIMES = ["全部", "工作日晚", "周末上午", "周末下午", "周末晚", "全天"];
XH.SITES = ["全部", "金沙教学点", "东门教学点", "犀浦教学点", "光华教学点", "望江教学点", "线上优先"];

/** 年级 → 伴读学科（E+C 混搭级联） */
XH.GRADE_SUBJECTS = {
  "小学": ["语文", "数学", "英语"],
  "初中": ["语文", "数学", "英语", "物理", "化学", "初中体育"],
  "高中": ["语文", "数学", "英语", "物理", "化学", "生物"],
  "考研": ["考研数学", "考研英语", "考研政治"],
  "艺体": ["美术", "音乐", "体育", "舞蹈"]
};

/** 学科关键词归一，便于 mentor.subjects（如「高中数学」）匹配芯片「数学」 */
XH._subjectKey = function (s) {
  if (!s) return "";
  return String(s)
    .replace(/^艺体[·・.]?/, "")
    .replace(/^(小学|初中|高中|考研)/, "")
    .replace(/专项$/, "")
    .replace(/奥赛$/, "")
    .replace(/入门$/, "")
    .trim();
};

XH.mentorMatchesSubject = function (m, subject) {
  if (!subject) return true;
  var key = XH._subjectKey(subject);
  return m.subjects.some(function (s) {
    if (s === subject) return true;
    if (s.indexOf(subject) >= 0 || subject.indexOf(s) >= 0) return true;
    var mk = XH._subjectKey(s);
    if (mk && key && (mk === key || mk.indexOf(key) >= 0 || key.indexOf(mk) >= 0)) return true;
    // 艺体/钢琴 ↔ 音乐；信息学 ↔ 不进普通学科
    if (subject === "音乐" && /钢琴|音乐|艺体/.test(s)) return true;
    if (subject === "体育" && /体育/.test(s)) return true;
    if (subject === "美术" && /美术|绘画/.test(s)) return true;
    if (subject === "舞蹈" && /舞蹈/.test(s)) return true;
    if (subject === "初中体育" && /体育/.test(s)) return true;
    if (subject === "语文" && /语文|作文/.test(s)) return true;
    if (subject === "英语" && /英语/.test(s)) return true;
    if (subject === "考研英语" && /英语/.test(s)) return true;
    if (subject === "考研政治" && /政治/.test(s)) return true;
    if (subject === "考研数学" && /数学/.test(s) && m.grades.indexOf("考研") >= 0) return true;
    return false;
  });
};

XH.mentorMatchesGrade = function (m, grade) {
  if (!grade) return true;
  if (m.grades.indexOf(grade) >= 0) return true;
  if (grade === "艺体") {
    return m.grades.indexOf("艺体") >= 0 ||
      m.subjects.some(function (s) { return /艺体|钢琴|美术|音乐|体育|舞蹈|艺考/.test(s); });
  }
  return false;
};

XH.filterMentors = function (opts) {
  opts = opts || {};
  var grade = opts.grade;
  var subject = opts.subject;
  var time = opts.time;
  return XH.MENTORS.filter(function (m) {
    if (!XH.mentorMatchesGrade(m, grade)) return false;
    if (!XH.mentorMatchesSubject(m, subject)) return false;
    if (time && time !== "全部") {
      var s = m.slots.join(" ");
      if (time === "工作日晚" && !/周[一二三四五]晚/.test(s)) return false;
      if (time === "周末上午" && !/周[六日]上午/.test(s)) return false;
      if (time === "周末下午" && !/周[六日]下午/.test(s)) return false;
      if (time === "周末晚" && !/周[六日]晚/.test(s)) return false;
      if (time === "全天" && !/全天/.test(s)) return false;
    }
    return true;
  });
};

XH.getMentor = function (id) {
  return XH.MENTORS.find(function (m) { return m.id === id; });
};

XH.stars = function (n) {
  var full = Math.floor(n);
  var s = "★".repeat(full);
  if (n - full >= 0.5) s += "☆";
  return s + " " + n.toFixed(2);
};

XH.slotHtml = function (slots) {
  return slots.map(function (s) {
    return '<span class="slot-pill free">' + s + "</span>";
  }).join("");
};

XH.tagHtml = function (tags) {
  return tags.map(function (t) {
    return '<span class="tag">' + t + "</span>";
  }).join(" ");
};

/** Login / register wall modal */
XH._pendingContext = null;

XH.ensureModal = function () {
  if (document.getElementById("xh-login-modal")) return;
  var el = document.createElement("div");
  el.id = "xh-login-modal";
  el.className = "modal-backdrop";
  el.innerHTML =
    '<div class="modal modal-wrap" role="dialog" aria-modal="true" aria-labelledby="xh-login-title">' +
    '<button type="button" class="modal-close" aria-label="关闭" data-xh-close>×</button>' +
    '<div class="modal-head">' +
    '<h3 id="xh-login-title">登录后继续</h3>' +
    '<p>登录或注册后即可联系学伴；完整姓名、电话、微信与试讲视频需登录后可见。</p>' +
    "</div>" +
    '<div class="modal-body">' +
    '<div class="modal-ctx" id="xh-login-ctx">登录后继续，不会丢失刚才选的学伴。</div>' +
    '<div class="field"><label>手机号</label><div class="phone-row"><span class="prefix">+86</span>' +
    '<input type="tel" id="xh-phone" placeholder="请输入手机号" maxlength="11" autocomplete="tel"></div></div>' +
    '<div class="field"><label>验证码</label><div class="code-row">' +
    '<input type="text" id="xh-code" placeholder="6 位验证码" maxlength="6">' +
    '<button type="button" class="btn btn-secondary" id="xh-send-code">获取验证码</button></div></div>' +
    '<div class="modal-foot">' +
    '<button type="button" class="btn btn-primary btn-lg btn-block" id="xh-do-login">登录并继续</button>' +
    '<p class="modal-alt">还没有账号？<a href="#" id="xh-go-register">去注册</a></p>' +
    '<p class="modal-hint">预览页：点击登录仅作演示，不会真实提交。</p>' +
    "</div></div></div>";
  document.body.appendChild(el);

  el.addEventListener("click", function (e) {
    if (e.target === el || e.target.hasAttribute("data-xh-close")) XH.closeLogin();
  });
  document.getElementById("xh-send-code").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true;
    var n = 60;
    btn.textContent = n + "s";
    var t = setInterval(function () {
      n--;
      if (n <= 0) {
        clearInterval(t);
        btn.disabled = false;
        btn.textContent = "获取验证码";
      } else btn.textContent = n + "s";
    }, 1000);
  });
  document.getElementById("xh-do-login").addEventListener("click", function () {
    var ctx = XH._pendingContext;
    XH.closeLogin();
    var toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);z-index:200;" +
      "background:#134e4a;color:#fff;padding:.65rem 1.1rem;border-radius:999px;font-size:.85rem;" +
      "font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.2)";
    toast.textContent = ctx
      ? "演示：已登录，将回到「" + ctx + "」"
      : "演示：已登录";
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 2200);
  });
  document.getElementById("xh-go-register").addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("xh-login-title").textContent = "注册新账号";
    document.querySelector("#xh-login-modal .modal-head p").textContent =
      "注册后即可预约学伴；我们不会在未登录时展示完整联系方式。";
    document.getElementById("xh-do-login").textContent = "注册并继续";
  });
};

/**
 * @param {object} opts
 * @param {string} [opts.mentorName] display name
 * @param {string} [opts.action] 感兴趣 / 约TA / 联系学伴 / 选TA
 */
XH.openLogin = function (opts) {
  opts = opts || {};
  XH.ensureModal();
  var name = opts.mentorName || "该学伴";
  var action = opts.action || "继续操作";
  XH._pendingContext = name + " · " + action;
  var ctx = document.getElementById("xh-login-ctx");
  ctx.innerHTML =
    "你正在对 <strong>" +
    name +
    "</strong> 执行「" +
    action +
    "」。登录后继续，不会丢失刚才选的学伴。";
  document.getElementById("xh-login-title").textContent = "登录后继续";
  document.querySelector("#xh-login-modal .modal-head p").textContent =
    "登录或注册后即可联系学伴；完整姓名、电话、微信与试讲视频需登录后可见。";
  document.getElementById("xh-do-login").textContent = "登录并继续";
  document.getElementById("xh-login-modal").classList.add("open");
  document.body.style.overflow = "hidden";
};

XH.closeLogin = function () {
  var el = document.getElementById("xh-login-modal");
  if (el) el.classList.remove("open");
  document.body.style.overflow = "";
};

XH.topbar = function (opts) {
  opts = opts || {};
  var want = opts.wantBadge != null ? opts.wantBadge : "";
  var extra = opts.extraActions || "";
  return (
    '<header class="xh-top">' +
    '<a class="xh-logo" href="index.html"><span class="mark">星</span>星火伴学</a>' +
    '<nav class="xh-nav"><a href="#" class="active">找学伴</a>' +
    '<a href="index.html" style="opacity:.7">方案首页</a></nav>' +
    '<div class="xh-top-actions">' +
    extra +
    (want !== ""
      ? '<span class="muted" style="font-size:.8rem">想看 <span class="badge-count" id="xh-want-count">' +
        want +
        "</span></span>"
      : "") +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="XH.openLogin({action:\'登录\'})">登录</button>' +
    "</div></header>"
  );
};
