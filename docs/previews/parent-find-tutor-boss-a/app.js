/* 家长查找导师 · 方案 A Boss 双栏 · 预览逻辑 */
(function () {
  "use strict";

  var TUTORS = [
    {
      id: "t1",
      avatarLetter: "赵",
      maskedName: "赵老师",
      university: "西南财经大学",
      degree: "全日制本科毕业",
      subjects: ["数学"],
      grades: ["高中", "考研"],
      hourlyRate: 190,
      matchScore: 99.5,
      scoreHighlight: "考研数学三 142 分",
      totalHours: 155,
      syllabusTopics: ["大函数模型归纳", "解题技巧提炼", "高频模型拆解"],
      styles: ["节奏稳健", "板书清晰"],
      space: "武侯川大望江微网点",
      spaceKey: "武侯川大",
      slots: ["周三晚", "周五晚", "周六上午"],
      rating: 4.97,
      bio: "西南财大数学背景，擅长考研数学与高中函数压轴。课堂先诊断薄弱点，再按周拆解刷题节奏；板书清晰、节奏稳，适合冲刺与查漏补缺。",
      videoTitle: "函数模型归纳 · 15 分钟试讲"
    },
    {
      id: "t2",
      avatarLetter: "李",
      maskedName: "李老师",
      university: "电子科技大学",
      degree: "全日制本科在读",
      subjects: ["物理"],
      grades: ["初中", "高中"],
      hourlyRate: 110,
      matchScore: 98.2,
      scoreHighlight: "物理竞赛省二 · 电磁学强项",
      totalHours: 98,
      syllabusTopics: ["受力分析建模", "电路动态分析", "实验题技巧"],
      styles: ["类比讲解", "实验演示"],
      space: "高新大源微网点",
      spaceKey: "高新大源",
      slots: ["周二晚", "周六全天"],
      rating: 4.91,
      bio: "电子科大在读，物理竞赛省二。擅长把抽象概念讲成日常类比，可带简易演示帮助理解受力与电路，适合初高中物理同步与提高。",
      videoTitle: "受力分析建模 · 试讲片段"
    },
    {
      id: "t3",
      avatarLetter: "陈",
      maskedName: "陈老师",
      university: "四川大学",
      degree: "全日制本科毕业",
      subjects: ["英语"],
      grades: ["初中", "高中"],
      hourlyRate: 130,
      matchScore: 97.8,
      scoreHighlight: "专四优秀 · 高考英语 142",
      totalHours: 210,
      syllabusTopics: ["阅读长难句", "写作模板拆解", "听力精听法"],
      styles: ["口语强", "耐心细致"],
      space: "青羊金沙微网点",
      spaceKey: "青羊金沙",
      slots: ["周四晚", "周日下午"],
      rating: 4.94,
      bio: "川大英语专业，专四优秀。侧重听说与阅读理解，作业反馈及时；课堂用情境对话帮助学生开口，适合中高考英语冲刺。",
      videoTitle: "阅读长难句拆解 · 试讲"
    },
    {
      id: "t4",
      avatarLetter: "周",
      maskedName: "周老师",
      university: "四川大学",
      degree: "全日制硕士在读",
      subjects: ["化学"],
      grades: ["初中", "高中"],
      hourlyRate: 125,
      matchScore: 96.5,
      scoreHighlight: "化学竞赛省三 · 方程式专项",
      totalHours: 76,
      syllabusTopics: ["元素周期律", "氧化还原", "实验安全与设计"],
      styles: ["思维导图", "题型归类"],
      space: "武侯川大望江微网点",
      spaceKey: "武侯川大",
      slots: ["周一晚", "周三晚", "周五晚"],
      rating: 4.88,
      bio: "川大化学系研一，善于用思维导图整理元素与反应类型。讲解方程式与实验题条分缕析，适合中考/高考化学冲刺。",
      videoTitle: "氧化还原题型归类 · 试讲"
    },
    {
      id: "t5",
      avatarLetter: "吴",
      maskedName: "吴老师",
      university: "电子科技大学",
      degree: "全日制本科在读",
      subjects: ["数学"],
      grades: ["初中", "高中"],
      hourlyRate: 145,
      matchScore: 98.9,
      scoreHighlight: "高考数学 148 · 几何动点专项",
      totalHours: 132,
      syllabusTopics: ["几何动点模型", "压轴综合题", "随堂查缺补漏"],
      styles: ["讲题清晰", "作业精细批改"],
      space: "高新大源微网点",
      spaceKey: "高新大源",
      slots: ["周二晚", "周四晚", "周六上午"],
      rating: 4.96,
      bio: "电子科大在读，高考数学 148。专注初三/高一几何动点与压轴综合，习惯先诊断再按周拆解；家长反馈进度透明、作业批改细致。",
      videoTitle: "几何动点模型 · 试讲片段"
    },
    {
      id: "t6",
      avatarLetter: "孙",
      maskedName: "孙老师",
      university: "四川师范大学",
      degree: "全日制本科在读",
      subjects: ["语文"],
      grades: ["小学", "初中"],
      hourlyRate: 95,
      matchScore: 95.4,
      scoreHighlight: "作文专项 · 周稿精细批改",
      totalHours: 188,
      syllabusTopics: ["记叙文结构", "素材积累", "阅读理解答题"],
      styles: ["家校沟通", "基础夯实"],
      space: "青羊金沙微网点",
      spaceKey: "青羊金沙",
      slots: ["周三下午", "周六上午", "周日上午"],
      rating: 4.93,
      bio: "川师大小学教育背景，带过托管班作文课。注重素材积累与结构训练，一周一稿精细批改，适合小学中高年级与初一语文。",
      videoTitle: "记叙文结构训练 · 试讲"
    },
    {
      id: "t7",
      avatarLetter: "何",
      maskedName: "何老师",
      university: "四川音乐学院",
      degree: "全日制本科在读",
      subjects: ["艺考"],
      grades: ["高中", "艺体"],
      hourlyRate: 160,
      matchScore: 94.1,
      scoreHighlight: "钢琴十级 · 艺考文化课陪练",
      totalHours: 64,
      syllabusTopics: ["艺考文化课规划", "考级曲目辅导", "视唱练耳"],
      styles: ["课堂轻松", "考级辅导"],
      space: "青羊金沙微网点",
      spaceKey: "青羊金沙",
      slots: ["周六下午", "周日下午"],
      rating: 4.90,
      bio: "川音钢琴表演在读，钢琴十级。可兼顾艺考文化课规划与考级陪练，课堂轻松有趣，适合艺考生文化课补强。",
      videoTitle: "艺考文化课规划 · 简介"
    }
  ];

  var SUBJECTS = [
    { v: "all", label: "全部学科" },
    { v: "数学", label: "初高中数学" },
    { v: "物理", label: "初高中物理" },
    { v: "英语", label: "中高考英语" },
    { v: "化学", label: "初高中化学" },
    { v: "语文", label: "语文学科" },
    { v: "艺考", label: "美术/音乐艺考" }
  ];
  var GRADES = [
    { v: "all", label: "全部年级" },
    { v: "小学", label: "小学" },
    { v: "初中", label: "初中" },
    { v: "高中", label: "高中" },
    { v: "考研", label: "考研" },
    { v: "艺体", label: "艺体" }
  ];
  var TIMES = [
    { v: "all", label: "全部时段" },
    { v: "工作日晚", label: "工作日晚" },
    { v: "周末上午", label: "周末上午" },
    { v: "周末下午", label: "周末下午" },
    { v: "周末全天", label: "周末全天" }
  ];
  var SPACES = [
    { v: "all", label: "全部成都市网点", dark: true },
    { v: "青羊金沙", label: "青羊金沙" },
    { v: "高新大源", label: "高新大源" },
    { v: "武侯川大", label: "武侯川大望江" }
  ];

  var state = {
    subject: "all",
    grade: "all",
    time: "all",
    space: "all",
    sort: "matchDesc",
    rateMin: 80,
    rateMax: 210,
    q: "",
    currentId: null
  };

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var el = $("toast");
    el.innerHTML = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  function matchTime(tutor, t) {
    if (t === "all") return true;
    var s = tutor.slots.join(" ");
    if (t === "工作日晚") return /周[一二三四五]晚/.test(s);
    if (t === "周末上午") return /周[六日]上午/.test(s);
    if (t === "周末下午") return /周[六日]下午/.test(s);
    if (t === "周末全天") return /周[六日]全天|周六全天|周日全天/.test(s) || (/周[六日]/.test(s) && /上午|下午|晚/.test(s));
    return true;
  }

  function filtered() {
    var list = TUTORS.filter(function (t) {
      if (state.subject !== "all" && t.subjects.indexOf(state.subject) < 0) return false;
      if (state.grade !== "all" && t.grades.indexOf(state.grade) < 0) return false;
      if (state.space !== "all" && t.spaceKey !== state.space) return false;
      if (t.hourlyRate < state.rateMin || t.hourlyRate > state.rateMax) return false;
      if (!matchTime(t, state.time)) return false;
      if (state.q) {
        var hay = [
          t.maskedName, t.university, t.degree, t.scoreHighlight, t.space,
          t.subjects.join(" "), t.syllabusTopics.join(" "), t.styles.join(" ")
        ].join(" ").toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
      }
      return true;
    });

    list.sort(function (a, b) {
      if (state.sort === "matchDesc") return b.matchScore - a.matchScore;
      if (state.sort === "ratingDesc") return b.rating - a.rating;
      if (state.sort === "rateAsc") return a.hourlyRate - b.hourlyRate;
      if (state.sort === "rateDesc") return b.hourlyRate - a.hourlyRate;
      if (state.sort === "hoursDesc") return b.totalHours - a.totalHours;
      return 0;
    });
    return list;
  }

  function renderChips(el, items, key, useDark) {
    el.innerHTML = items.map(function (it) {
      var on = state[key] === it.v;
      var cls = "chip" + (on ? (useDark && it.dark ? " on-dark" : " on") : "");
      return '<button type="button" class="' + cls + '" data-v="' + it.v + '">' + it.label + "</button>";
    }).join("");
    el.querySelectorAll(".chip").forEach(function (c) {
      c.addEventListener("click", function () {
        state[key] = c.getAttribute("data-v");
        renderChips(el, items, key, useDark);
        render();
      });
    });
  }

  function shortSpace(space) {
    return String(space || "").replace(/微网点$/, "");
  }

  function cardHtml(t) {
    var active = state.currentId === t.id ? " active" : "";
    return (
      '<article class="m-card' + active + '" data-id="' + t.id + '" role="button" tabindex="0">' +
        '<div class="m-top">' +
          '<div class="m-id">' +
            '<div class="avatar">' + t.avatarLetter + "</div>" +
            "<div>" +
              '<div class="m-name"><h3>' + t.maskedName + '</h3><span class="chsi">学信网在籍</span></div>' +
              '<div class="m-school">' + t.university + ' · <span>' + t.degree + "</span></div>" +
            "</div>" +
          "</div>" +
          '<div class="m-price">' +
            '<div class="yen">¥' + t.hourlyRate + "<small>/h</small></div>" +
            '<span class="match-pill">' + t.matchScore + "% 契合</span>" +
          "</div>" +
        "</div>" +
        '<div class="highlight-row">' +
          '<div class="hl"><i class="fa-solid fa-award"></i><span>' + t.scoreHighlight + "</span></div>" +
          '<span class="hrs">' + t.totalHours + "课时</span>" +
        "</div>" +
        "<div>" +
          '<span class="section-label">主辅考纲重点：</span>' +
          '<div class="tags">' +
            t.syllabusTopics.map(function (x) {
              return '<span class="tag" title="' + x + '">' + x + "</span>";
            }).join("") +
          "</div>" +
          '<div class="tags" style="margin-top:.35rem">' +
            t.styles.map(function (x) {
              return '<span class="style-tag">' + x + "</span>";
            }).join("") +
          "</div>" +
        "</div>" +
        '<div class="m-foot">' +
          '<div class="m-loc"><i class="fa-solid fa-location-dot"></i><span>' + shortSpace(t.space) + "</span></div>" +
          '<div class="m-actions">' +
            '<button type="button" class="btn-ghost-sm" data-video="' + t.id + '"><i class="fa-solid fa-circle-play"></i>试讲视频</button>' +
            '<button type="button" class="btn-primary-sm" data-book="' + t.id + '">预约试讲 <i class="fa-solid fa-angle-right"></i></button>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function getTutor(id) {
    return TUTORS.find(function (t) { return t.id === id; });
  }

  function openDrawer(id) {
    var t = getTutor(id);
    if (!t) return;
    state.currentId = id;
    renderListOnly();

    $("drawer-title").textContent = t.maskedName;
    $("drawer-code").textContent = "XH-" + id.toUpperCase();
    $("drawer-body").innerHTML =
      '<div style="display:flex;gap:.85rem;align-items:center">' +
        '<div class="avatar lg">' + t.avatarLetter + "</div>" +
        "<div>" +
          '<div class="m-name"><h3 style="font-size:1.1rem">' + t.maskedName + '</h3><span class="chsi">学信网在籍</span></div>' +
          '<div class="m-school">' + t.university + " · " + t.degree + "</div>" +
          '<div style="margin-top:.35rem;font-size:.75rem;color:#64748b">★ ' + t.rating + " · " + t.totalHours + " 课时履约</div>" +
        "</div>" +
      "</div>" +
      '<p class="bio">' + t.bio + "</p>" +
      '<span class="section-label">主辅考纲重点</span>' +
      '<div class="tags" style="margin-bottom:.65rem">' +
        t.syllabusTopics.map(function (x) { return '<span class="tag">' + x + "</span>"; }).join("") +
      "</div>" +
      '<div class="tags" style="margin-bottom:.75rem">' +
        t.styles.map(function (x) { return '<span class="style-tag">' + x + "</span>"; }).join("") +
        t.subjects.map(function (x) { return '<span class="style-tag">' + x + "</span>"; }).join("") +
      "</div>" +
      '<div class="meta-line"><i class="fa-solid fa-location-dot" style="color:var(--teal-600);margin-right:.25rem"></i>' +
        t.space + ' · <span class="price">¥' + t.hourlyRate + "/h</span>" +
        ' · <span class="match-pill">' + t.matchScore + "% 契合</span></div>" +
      '<span class="section-label">可约时段</span>' +
      '<div class="slots">' + t.slots.map(function (s) { return '<span class="slot">' + s + "</span>"; }).join("") + "</div>" +
      '<span class="section-label">' + t.videoTitle + "</span>" +
      '<div class="trial-box" id="trial-play" role="button" tabindex="0">' +
        '<div class="play"><i class="fa-solid fa-play"></i></div>' +
        '<div class="trial-lock"><span>🔒 试讲片段预览</span><small>完整试讲登录后可观看（本页为效果预览）</small></div>' +
      "</div>" +
      '<p class="privacy-note">完整姓名、微信、电话等联系方式需登录后可见。本预览不发短信、不开单。</p>';

    $("drawer").classList.add("open");
    $("drawer-bg").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");

    var trial = $("trial-play");
    if (trial) {
      trial.onclick = function () {
        toast('试讲视频「' + t.videoTitle + '」· <span class="teal">预览占位</span>');
      };
    }
  }

  function closeDrawer() {
    state.currentId = null;
    $("drawer").classList.remove("open");
    $("drawer-bg").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    renderListOnly();
  }

  function bindCardEvents(box) {
    box.querySelectorAll(".m-card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest("[data-video],[data-book]")) return;
        openDrawer(card.getAttribute("data-id"));
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDrawer(card.getAttribute("data-id"));
        }
      });
    });
    box.querySelectorAll("[data-video]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var t = getTutor(b.getAttribute("data-video"));
        if (!t) return;
        openDrawer(t.id);
        toast('打开试讲：「' + t.videoTitle + '」');
      });
    });
    box.querySelectorAll("[data-book]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var t = getTutor(b.getAttribute("data-book"));
        if (!t) return;
        toast('已选择 <span class="teal">' + t.maskedName + '</span> · 预约试讲（预览不真下单）');
      });
    });
  }

  function renderListOnly() {
    var list = filtered();
    $("tutorCountBadge").textContent = String(list.length);
    var box = $("tutorList");
    var empty = $("empty");
    if (!list.length) {
      box.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    box.innerHTML = list.map(cardHtml).join("");
    bindCardEvents(box);
  }

  function render() {
    $("minRateLabel").textContent = String(state.rateMin);
    $("maxRateLabel").textContent = String(state.rateMax);
    renderListOnly();
  }

  function resetFilters() {
    state.subject = "all";
    state.grade = "all";
    state.time = "all";
    state.space = "all";
    state.sort = "matchDesc";
    state.rateMin = 80;
    state.rateMax = 210;
    state.q = "";
    $("mainSearch").value = "";
    $("sortSelect").value = "matchDesc";
    $("rateMin").value = "80";
    $("rateMax").value = "210";
    renderChips($("f-subject"), SUBJECTS, "subject", false);
    renderChips($("f-grade"), GRADES, "grade", false);
    renderChips($("f-time"), TIMES, "time", false);
    renderChips($("f-space"), SPACES, "space", true);
    render();
    toast("已重置筛选条件");
  }

  function switchTab(name) {
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    if (name !== "find") {
      toast('「' + ({ courses: "我的课程", account: "我的账户" }[name] || name) + '」面板 · 本预览仅做查找导师双栏');
    }
  }

  // init
  renderChips($("f-subject"), SUBJECTS, "subject", false);
  renderChips($("f-grade"), GRADES, "grade", false);
  renderChips($("f-time"), TIMES, "time", false);
  renderChips($("f-space"), SPACES, "space", true);

  $("mainSearch").addEventListener("input", function () {
    state.q = this.value.trim();
    render();
  });
  $("btnSearch").addEventListener("click", function () {
    state.q = $("mainSearch").value.trim();
    render();
    toast(state.q ? ('检索「' + state.q + '」') : "已刷新列表");
  });
  $("btnReset").addEventListener("click", resetFilters);
  $("sortSelect").addEventListener("change", function () {
    state.sort = this.value;
    render();
  });
  $("rateMin").addEventListener("input", function () {
    var v = Number(this.value);
    if (v > state.rateMax) {
      state.rateMax = v;
      $("rateMax").value = String(v);
    }
    state.rateMin = v;
    render();
  });
  $("rateMax").addEventListener("input", function () {
    var v = Number(this.value);
    if (v < state.rateMin) {
      state.rateMin = v;
      $("rateMin").value = String(v);
    }
    state.rateMax = v;
    render();
  });

  $("drawer-close").onclick = closeDrawer;
  $("drawer-bg").onclick = closeDrawer;
  $("drawer-book").onclick = function () {
    var t = getTutor(state.currentId);
    if (t) toast('约TA · <span class="teal">' + t.maskedName + '</span>（预览确认，不发短信）');
  };
  $("drawer-video").onclick = function () {
    var t = getTutor(state.currentId);
    if (t) toast('试讲视频「' + t.videoTitle + '」');
  };

  document.querySelectorAll(".tab-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      switchTab(b.getAttribute("data-tab"));
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  render();
})();
