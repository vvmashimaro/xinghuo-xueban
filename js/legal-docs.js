/**
 * 星火学伴 · 综合服务协议 / 个人信息保护政策
 * 演示模板正文内嵌，供静态页离线打开弹窗（无需 fetch）。
 * 同步文稿见 docs/服务协议.md 、 docs/个人信息保护政策.md
 */
(function (global) {
  'use strict';

  var DEMO_BANNER =
    '<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-950 leading-relaxed">' +
    '<i class="fa-solid fa-triangle-exclamation text-amber-600 mr-1"></i>' +
    '<strong>演示说明：</strong>本文本为「星火学伴」产品演示 / MVP 法律页面模板，仅供界面展示。' +
    '正式上线前请委托专业律师审定。运营主体占位：【运营主体名称】，统一社会信用代码：【统一社会信用代码】。' +
    '</div>';

  var SERVICE_HTML =
    DEMO_BANNER +
    '<p class="text-[11px] text-slate-500">版本：演示模板 v1.0 · 更新日期：2026年9月16日</p>' +
    '<p class="text-slate-800 font-bold">第一条 定义</p>' +
    '<p>1. <strong>平台 / 「星火学伴」</strong>：指由【运营主体名称】运营的课业辅导撮合、预约调度、资金托管对接及可选智能教学微空间（IoT 教学仓）相关技术服务系统。</p>' +
    '<p>2. <strong>用户</strong>：指注册并使用平台的家长/学员、大学生导师及其他经许可的使用主体。</p>' +
    '<p>3. <strong>导师</strong>：经实名与资质核验、并通过平台审核后可承接辅导匹配的服务提供方。</p>' +
    '<p>4. <strong>家长/学员</strong>：通过平台发布学情需求、预约辅导并支付课酬的服务接受方。</p>' +
    '<p>5. <strong>资金托管</strong>：指课酬在合作金融机构或存管通道中按「一课一约、一课一消」原则预先冻结，并于约定条件成就后划拨的安排。</p>' +
    '<p>6. <strong>智能教学仓 / IoT 教学微空间</strong>：平台可选提供的线下教学空间及相关门禁、通电、签到等物联网能力，是否可用以实际匹配结果为准。</p>' +
    '<p class="text-slate-800 font-bold">第二条 服务内容</p>' +
    '<p>平台主要提供：导师入驻与后台审核；家长/学员注册、学情建档与导师匹配；每周固定时段约课、请假与改期协同；课酬资金托管冻结、课后观察期解冻与分成划拨对接；可选 IoT 教学仓预约与到课核销辅助；以及消息通知、客服协调等配套服务（以页面公示功能为准）。</p>' +
    '<p>平台不开展学科培训办学，不作升学、保分或效果承诺；辅导内容由导师与家长/学员自行协商，并应遵守国家教育相关法律法规。</p>' +
    '<p class="text-slate-800 font-bold">第三条 账号注册与使用</p>' +
    '<p>1. 用户应使用真实、准确、完整的信息进行注册并及时更新。导师须配合完成实名、学籍/学历核验及结算账户绑定等流程。</p>' +
    '<p>2. 账号仅限本人使用，不得出借、转让、出售。因保管不善导致的损失由用户自行承担（法律另有规定除外）。</p>' +
    '<p>3. 不得利用平台从事违法违规、虚假宣传、线下私下收费规避托管、干扰匹配公平或侵害他人合法权益的行为。</p>' +
    '<p>4. 平台有权对涉嫌违规账号采取警示、限制功能、暂停或终止服务等措施，并保留依法追究责任的权利。</p>' +
    '<p class="text-slate-800 font-bold">第四条 约课、取消与请假</p>' +
    '<p>1. <strong>固定时段预约</strong>：支持按周固定时间段预约；可约时段以导师排期与教学仓档期为准。</p>' +
    '<p>2. <strong>请假 / 改期</strong>：一方因故无法上课的，应至少提前 <strong>1 天</strong> 发起申请，并经对方确认后生效。未按规则提前确认导致空档的，可按公示规则处理课酬与信用记录。</p>' +
    '<p>3. 开课前较短时限内的撤销、退改规则以订单页、资金托管相关协议及平台公示为准；因不可抗力或双方确认未实际授课的，可协商原路退回已冻结课酬。</p>' +
    '<p>4. 到课签到与课后核销是资金解冻的重要依据，用户应如实配合，不得虚假打卡。</p>' +
    '<p class="text-slate-800 font-bold">第五条 费用与资金托管</p>' +
    '<p>1. 课酬采用「一课一约、一课一消」：约课成功后对应课时费预先冻结；平台不设大额预存培训费包、不设资金池代收代付。</p>' +
    '<p>2. 双方完成到课与课后核销后，课酬进入观察期：<strong class="text-teal-800">课后 48 小时内</strong>如无有效投诉或其他约定/法定冻结事由，系统自动解冻划拨。</p>' +
    '<p>3. 划拨比例原则上为：<strong>导师实收 92%</strong>、<strong>平台技术与空间运营服务费 8%</strong>；如平台另行公示分成规则的，以届时公示为准。</p>' +
    '<p>4. 观察期内若存在有效投诉或争议，资金继续冻结，由平台客服协调；仍无法解决的，按争议条款处理。</p>' +
    '<p>5. 支付、退款、结算时效可能受银行或支付通道影响；非因平台过错导致的延迟，平台在法律允许范围内不承担责任。</p>' +
    '<p class="text-slate-800 font-bold">第六条 双方权利与义务</p>' +
    '<p><strong>（一）家长/学员</strong>：如实提供学情与联系信息，按时到课或按规则请假；不得诱导导师绕开平台私下交易；理性评价辅导效果。</p>' +
    '<p><strong>（二）导师</strong>：保证资料真实、合规授课，尊重未成年人保护与家长知情同意；不得私下收费、虚假签到或泄露学员隐私；请假须按规则提前确认。</p>' +
    '<p><strong>（三）平台</strong>：维护撮合、预约、托管对接与（如开通）教学仓相关基础服务；对入驻审核与投诉协调提供合理支持；依法保护用户个人信息（详见《个人信息保护政策》）。</p>' +
    '<p class="text-slate-800 font-bold">第七条 平台责任限制</p>' +
    '<p>1. 平台为信息撮合与技术服务提供方，辅导合同关系主要发生于家长/学员与导师之间（法律另有规定或平台另有明示承诺除外）。</p>' +
    '<p>2. 因网络故障、第三方支付/银行通道、不可抗力、用户自身原因或第三方侵害导致的中断或损失，平台在法律允许范围内免责或仅承担与过错相适应的责任。</p>' +
    '<p>3. 演示环境中的数据、匹配结果、仓位状态等可能为模拟或样例，不作为真实履约依据。</p>' +
    '<p class="text-slate-800 font-bold">第八条 违约与争议解决</p>' +
    '<p>一方违反本协议给对方或平台造成损失的，应依法承担责任。争议应先行协商；协商不成可向客服提交证据请求协调；仍无法解决的，提交【运营主体名称】住所地有管辖权的人民法院诉讼解决（演示模板，正式版以审定条款为准）。</p>' +
    '<p class="text-slate-800 font-bold">第九条 协议变更</p>' +
    '<p>平台可根据业务与合规需要修订本协议，并通过页面公告、弹窗或站内通知提示。修订于公示载明的生效日起生效；用户继续使用服务视为接受更新后的协议（法律另有规定除外）。</p>' +
    '<p class="text-slate-800 font-bold">第十条 生效及其他</p>' +
    '<p>1. 用户在登录、注册或勾选同意本协议时，即视为已阅读并同意受本协议约束。</p>' +
    '<p>2. 本协议与《个人信息保护政策》、页面专项协议（如《资金托管与服务协议》）不一致时：涉及资金托管与结算的专项约定优先；涉及个人信息处理的，以《个人信息保护政策》为准。</p>' +
    '<p>3. 联系方式（演示占位）：客服邮箱【客服邮箱】、客服电话【客服电话】。</p>';

  var PRIVACY_HTML =
    DEMO_BANNER +
    '<p class="text-[11px] text-slate-500">版本：演示模板 v1.0 · 更新日期：2026年9月16日 · 文中「反洗钱与资金清算授权」为政策专节，登录页统一以《个人信息保护政策》指称。</p>' +
    '<p>我们深知个人信息对您的重要性。本政策说明我们如何收集、使用、存储、共享与保护您的信息，以及您享有的权利。</p>' +
    '<p class="text-slate-800 font-bold">一、我们如何收集与使用个人信息</p>' +
    '<p>为实现导师入驻审核、家长/学员注册匹配、约课履约、资金托管结算及可选 IoT 教学仓服务，我们可能在征得同意或依法具备其他合法性基础时处理下列信息：</p>' +
    '<p><strong>1. 账号与实名信息</strong>：手机号、验证码、登录凭证；姓名、证件类型与号码；导师侧可能还包括学籍/学历核验信息、结算用银行账户信息（卡号脱敏展示、开户行等）。目的：注册登录、身份核验、防欺诈、满足监管与结算要求。</p>' +
    '<p><strong>2. 学情与匹配信息</strong>：学员昵称/称谓、年级、目标学科、学习诉求与节奏偏好等。目的：建立辅导档案、匹配导师、优化约课体验。</p>' +
    '<p><strong>3. 约课与履约信息</strong>：预约时段、请假/改期记录、到课签到、课后核销、教学仓（如有）门禁或通电相关日志。目的：履行约课、争议举证、空间安全与运营统计。</p>' +
    '<p><strong>4. 交易与托管相关信息</strong>：订单金额、冻结/解冻状态、支付通道回执、分成划拨结果等。目的：完成「一课一消」托管结算、对账与售后。</p>' +
    '<p><strong>5. 设备与日志信息</strong>：设备型号、操作系统、浏览器类型、IP、崩溃与操作日志等。目的：保障安全稳定、排查故障、预防滥用。</p>' +
    '<p><strong>6. 客服与反馈信息</strong>：沟通内容与凭证材料。目的：响应咨询、投诉与争议协调。</p>' +
    '<p>拒绝提供非必要信息不会导致无法使用基本功能，但可能无法使用依赖该信息的特定服务（如实名入驻或托管结算）。</p>' +
    '<p class="text-slate-800 font-bold">二、个人信息的使用规则</p>' +
    '<p>我们仅在所述目的范围内使用信息：提供与改进核心功能；发送约课提醒、请假确认、资金状态等服务通知；开展安全风控、审计与依法合规报送；在匿名化/去标识化后用于统计分析。未经同意不将个人信息用于无关营销推送。</p>' +
    '<p class="text-slate-800 font-bold">三、存储地点、方式与期限</p>' +
    '<p>1. 原则上存储于中华人民共和国境内；演示产品默认不跨境。</p>' +
    '<p>2. 采取加密、访问控制等合理技术与管理措施。</p>' +
    '<p>3. 在实现处理目的所必需的最短时间内保存；超期后删除或匿名化。因法律、会计、反洗钱或争议解决需要的，可在必要期限内继续保存。</p>' +
    '<p>4. 账号注销后按法律规定删除或匿名化，依法需留存的除外。</p>' +
    '<p class="text-slate-800 font-bold">四、共享、转让、公开披露与委托处理</p>' +
    '<p>原则上不向第三方共享。例外包括：获得您的单独同意；为实现托管结算与合作银行/支付机构共享必要交易与身份一致性信息；为公安实名、学信核验等向合法接口提供必要字段；根据法律法规或有权机关依法要求。涉及合并分立收购时，承继方须继续受本政策约束。我们不会出售您的个人信息。委托云服务、短信、客服等供应商时将签订数据处理条款。</p>' +
    '<p class="text-slate-800 font-bold">五、反洗钱与资金清算授权（专节）</p>' +
    '<p>为落实反洗钱、反恐怖融资及商业银行资金存管监管要求，并完成课酬冻结与划拨，在您使用支付/结算功能时：</p>' +
    '<p>1. 您理解并同意，平台及合作银行/支付机构可在最小必要范围内核验姓名、证件号、银行账户等一致性信息；</p>' +
    '<p>2. 您授权对交易流水、冻结与解冻记录进行留存与调阅，期限符合金融监管与反洗钱规定；</p>' +
    '<p>3. 如监测到可疑交易，合作机构或平台可依法暂停结算、要求补充说明或向有权机关报告；</p>' +
    '<p>4. 本专节是《个人信息保护政策》的组成部分；专项资金规则仍以《资金托管与服务协议》等页面协议为准。</p>' +
    '<p class="text-slate-800 font-bold">六、您的权利</p>' +
    '<p>在适用法律范围内，您有权查阅、复制、更正、补充、删除依法可删除的信息；改变授权范围或撤回同意；注销账号；依法请求转移协助；对自动化决策提出拒绝或说明请求（如适用）。可通过平台反馈入口或本政策联系方式提出，我们将在核实身份后合理期限内答复。</p>' +
    '<p class="text-slate-800 font-bold">七、未成年人保护</p>' +
    '<p>平台涉及中小学科学情辅导，学员多为未成年人。我们要求由父母或其他监护人注册、约课并行使相关权利。处理不满十四周岁未成年人个人信息，将依法征得监护人同意，并仅在未成年人权益所必要的范围内处理。监护人如发现未经同意的收集，请及时联系我们删除（法律另有规定除外）。</p>' +
    '<p class="text-slate-800 font-bold">八、Cookie 与同类技术</p>' +
    '<p>为维持登录态、记住偏好与分析访问，我们可能使用 Cookie 或本地存储等。您可通过浏览器设置管理；拒绝可能影响部分功能。演示环境中的统计能力可能简化或关闭。</p>' +
    '<p class="text-slate-800 font-bold">九、安全措施</p>' +
    '<p>我们采取传输加密、存储加密、权限分级、安全审计、员工保密义务等措施。任何措施均无法做到绝对安全。如发生或可能发生安全事件，我们将按法律要求告知并采取补救措施。</p>' +
    '<p class="text-slate-800 font-bold">十、本政策的更新</p>' +
    '<p>我们可能适时修订本政策。重大变更将通过页面公告、弹窗或显著提示通知。更新后的政策在载明之日起生效。继续使用服务即表示您已阅读并理解更新后的政策。</p>' +
    '<p class="text-slate-800 font-bold">十一、联系我们</p>' +
    '<p>运营主体：【运营主体名称】；个人信息保护负责人/邮箱：【隐私邮箱】；客服电话：【客服电话】；联系地址：【联系地址】。一般情况下将在十五个工作日内回复。</p>';

  var DOCS = {
    service: {
      key: 'service',
      title: '《星火学伴综合服务协议》',
      subtitle: '登录勾选所称《服务协议》· 请完整滚动阅读',
      bodyHtml: SERVICE_HTML
    },
    privacy: {
      key: 'privacy',
      title: '《个人信息保护政策》',
      subtitle: '含反洗钱与资金清算授权专节 · 请完整滚动阅读',
      bodyHtml: PRIVACY_HTML
    }
  };

  function ensureModal() {
    if (document.getElementById('legalDocModal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'legalDocModal';
    wrap.className =
      'fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-4 hidden opacity-0 transition-opacity duration-300';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML =
      '<div class="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transform transition-all duration-300 scale-95" id="legalDocModalContent">' +
      '  <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-teal-900 text-white shrink-0">' +
      '    <div class="min-w-0 pr-2">' +
      '      <h3 class="font-black text-sm truncate" id="legalDocModalTitle">法律文件</h3>' +
      '      <p class="text-[10px] text-teal-200/90 mt-0.5 truncate" id="legalDocModalSubtitle"></p>' +
      '    </div>' +
      '    <button type="button" data-legal-close class="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer shrink-0" aria-label="关闭">' +
      '      <i class="fa-solid fa-xmark text-xs"></i>' +
      '    </button>' +
      '  </div>' +
      '  <div class="px-5 py-4 overflow-y-auto text-xs text-slate-600 space-y-3 leading-relaxed flex-1" id="legalDocModalBody"></div>' +
      '  <div class="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">' +
      '    <button type="button" data-legal-close class="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer">关闭</button>' +
      '    <button type="button" id="legalDocAgreeBtn" class="bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-md shadow-teal-600/20 cursor-pointer">已阅 · 关闭</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(wrap);

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) closeLegalDoc();
    });
    wrap.querySelectorAll('[data-legal-close]').forEach(function (btn) {
      btn.addEventListener('click', closeLegalDoc);
    });
    var agree = document.getElementById('legalDocAgreeBtn');
    if (agree) {
      agree.addEventListener('click', function () {
        var box = document.getElementById('agreementCheckbox');
        if (box) box.checked = true;
        closeLegalDoc();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var m = document.getElementById('legalDocModal');
        if (m && !m.classList.contains('hidden')) closeLegalDoc();
      }
    });
  }

  function openLegalDoc(key) {
    var doc = DOCS[key];
    if (!doc) return;
    ensureModal();
    var modal = document.getElementById('legalDocModal');
    var content = document.getElementById('legalDocModalContent');
    var title = document.getElementById('legalDocModalTitle');
    var subtitle = document.getElementById('legalDocModalSubtitle');
    var body = document.getElementById('legalDocModalBody');
    title.textContent = doc.title;
    subtitle.textContent = doc.subtitle;
    body.innerHTML = doc.bodyHtml;
    body.scrollTop = 0;
    modal.classList.remove('hidden');
    setTimeout(function () {
      modal.classList.remove('opacity-0');
      content.classList.remove('scale-95');
    }, 10);
  }

  function closeLegalDoc() {
    var modal = document.getElementById('legalDocModal');
    var content = document.getElementById('legalDocModalContent');
    if (!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(function () {
      modal.classList.add('hidden');
    }, 260);
  }

  function openServiceAgreement(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    openLegalDoc('service');
  }

  function openPrivacyPolicy(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    openLegalDoc('privacy');
  }

  global.XinghuoLegalDocs = {
    docs: DOCS,
    open: openLegalDoc,
    close: closeLegalDoc,
    openServiceAgreement: openServiceAgreement,
    openPrivacyPolicy: openPrivacyPolicy,
    ensureModal: ensureModal
  };
  global.openServiceAgreement = openServiceAgreement;
  global.openPrivacyPolicy = openPrivacyPolicy;
  global.openLegalDoc = openLegalDoc;
  global.closeLegalDoc = closeLegalDoc;
})(typeof window !== 'undefined' ? window : this);
