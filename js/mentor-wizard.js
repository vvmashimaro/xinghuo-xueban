/**
 * 星火学伴 - 导师注册多步骤向导增强脚本
 * Feature 1: L1/L2 Multi-step Wizard with Auto-save/Auto-advance
 */

'use strict';

// ====== L1 Sub-step State ======
let currentL1SubStep = 1;
let l1SubStepValid = [false, false, false, false]; // 4 sub-steps

// ====== L2 Sub-step State ======
let currentL2SubStep = 1;
let l2SubStepValid = [false, false, false]; // 3 sub-steps

// ====== Auto-advance Locks ======
let __l1SubAutoLock = false;
let __l2SubAutoLock = false;
let __l1SubTimer = null;
let __l2SubTimer = null;

// ====== Field Groups ======
const L1_SUBSTEPS = {
  1: {  // 身份信息
    fields: ['realName', 'phone', 'idCard'],
    title: '身份信息',
    icon: 'fa-user',
    validator: function() {
      const name = (document.getElementById('realName')?.value || '').trim();
      const phone = (document.getElementById('phone')?.value || '').trim();
      const idCard = (document.getElementById('idCard')?.value || '').trim();
      return !!(name && phone && phone.length === 11 && idCard && idCard.length === 18);
    }
  },
  2: {  // 院校与学历
    fields: ['finalUniversityValue', 'educationLevel', 'chsiCode'],
    title: '院校学历',
    icon: 'fa-graduation-cap',
    validator: function() {
      const uni = (document.getElementById('finalUniversityValue')?.value || '').trim();
      const chsi = (document.getElementById('chsiCode')?.value || '').trim();
      return !!(uni && chsi && chsi.length >= 10);
    }
  },
  3: {  // 结算账户
    fields: ['bankName', 'bankCardNumber'],
    title: '结算账户',
    icon: 'fa-building-columns',
    validator: function() {
      const bankCard = (document.getElementById('bankCardNumber')?.value || '').trim();
      return !!(bankCard && bankCard.length >= 16);
    }
  },
  4: {  // 合规确认
    fields: ['nonPublicTeacherAgree', 'privacyAuthAgree'],
    title: '合规确认',
    icon: 'fa-shield-halved',
    validator: function() {
      const nonPublic = document.getElementById('nonPublicTeacherAgree')?.checked;
      const privacy = document.getElementById('privacyAuthAgree')?.checked;
      return !!(nonPublic && privacy);
    }
  }
};

const L2_SUBSTEPS = {
  1: {  // 授课科目
    title: '授课科目',
    icon: 'fa-book',
    validator: function() {
      const checked = document.querySelectorAll('input[name="subject"]:checked');
      const hasCustom = typeof customSubjectList !== 'undefined' && customSubjectList.length > 0;
      return checked.length > 0 || hasCustom;
    }
  },
  2: {  // 课时费与风格
    title: '课时费与风格',
    icon: 'fa-coins',
    validator: function() {
      const rate = (document.getElementById('hourlyRate')?.value || '').trim();
      return !!(rate && Number(rate) > 0);
    }
  },
  3: {  // 试讲与素材
    title: '试讲素材',
    icon: 'fa-video',
    validator: function() {
      const url = (document.getElementById('lectureUrl')?.value || '').trim();
      return !!url;
    }
  }
};

/**
 * Initialize wizard UI enhancements on page load
 */
function initMentorWizard() {
  injectL1SubStepUI();
  injectL2SubStepUI();
  bindFieldChangeListeners();
  restoreWizardState();
}

/**
 * Inject L1 sub-step progress indicators and navigation
 */
function injectL1SubStepUI() {
  const step1Card = document.getElementById('step1-card');
  if (!step1Card) return;

  // Find the header (first child with class border-b)
  const header = step1Card.querySelector('.border-b');
  if (!header) return;

  // Create progress indicator
  const progressHTML = `
    <div class="flex items-center justify-between text-xs mt-4 pt-4 border-t border-slate-100">
      ${Object.keys(L1_SUBSTEPS).map(i => `
        <button type="button" onclick="goToL1SubStep(${i})" id="l1SubTab${i}" 
          class="flex items-center gap-1.5 font-bold ${i == 1 ? 'text-teal-700' : 'text-slate-400'} cursor-pointer transition-colors">
          <span id="l1SubIcon${i}" class="w-5 h-5 rounded-full ${i == 1 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'} flex items-center justify-center text-[10px] font-bold transition-all">${i}</span>
          <span class="hidden sm:inline">${L1_SUBSTEPS[i].title}</span>
        </button>
        ${i < 4 ? '<div class="flex-1 h-0.5 bg-slate-200 mx-1.5 relative"><div id="l1SubProgress' + i + '" class="h-full bg-teal-600 transition-all w-0"></div></div>' : ''}
      `).join('')}
    </div>
  `;

  header.insertAdjacentHTML('afterend', progressHTML);

  // Organize existing fields into substep containers
  organizeL1Fields();
}

/**
 * Organize L1 fields into substep containers
 */
function organizeL1Fields() {
  const step1Card = document.getElementById('step1-card');
  if (!step1Card) return;

  // Get all direct children after the progress indicator
  const allChildren = Array.from(step1Card.children);
  const progressIdx = allChildren.findIndex(el => el.querySelector('#l1SubTab1'));
  if (progressIdx < 0) return;

  const contentChildren = allChildren.slice(progressIdx + 1);

  // Create substep containers
  for (let i = 1; i <= 4; i++) {
    const container = document.createElement('div');
    container.id = `l1-substep-${i}`;
    container.className = `space-y-4 ${i === 1 ? '' : 'hidden'}`;
    container.setAttribute('data-substep', i);
    step1Card.appendChild(container);
  }

  // Distribute fields based on their content
  contentChildren.forEach(child => {
    if (!child || !child.nodeType || child.nodeType !== 1) return;
    
    const html = child.outerHTML || '';
    const text = child.textContent || '';
    
    let targetSubstep = 1; // default
    
    // Substep 1: Identity fields (name, phone, ID)
    if (html.includes('id="realName"') || html.includes('id="phone"') || html.includes('id="idCard"') ||
        text.includes('真实姓名') || text.includes('手机号码') || text.includes('身份证号')) {
      targetSubstep = 1;
    }
    // Substep 2: University and CHSI (before bank section)
    else if (html.includes('id="provinceSelect"') || html.includes('id="universitySelect"') || 
             html.includes('id="educationLevel"') || html.includes('id="chsiCode"') || 
             html.includes('id="chsiResultPanel"') || html.includes('id="manualUniversityInput"') ||
             text.includes('就读') || text.includes('毕业高校') || text.includes('学信网') || text.includes('学历')) {
      targetSubstep = 2;
    }
    // Substep 3: Bank account (after CHSI, before checkboxes)
    else if (html.includes('id="bankName"') || html.includes('id="bankCardNumber"') || html.includes('id="bankAccountName"') ||
             text.includes('银行') || text.includes('清算账户') || text.includes('托管')) {
      targetSubstep = 3;
    }
    // Substep 4: Compliance checkboxes
    else if (html.includes('id="nonPublicTeacherAgree"') || html.includes('id="privacyAuthAgree"') ||
             text.includes('公立在职教师') || text.includes('隐私授权') || text.includes('合规')) {
      targetSubstep = 4;
    }
    
    const targetContainer = document.getElementById(`l1-substep-${targetSubstep}`);
    if (targetContainer && child.parentNode === step1Card) {
      targetContainer.appendChild(child);
    }
  });

  // Add navigation buttons to each substep
  addL1SubStepNavigation();
}

/**
 * Add navigation buttons to L1 substeps
 */
function addL1SubStepNavigation() {
  for (let i = 1; i <= 4; i++) {
    const container = document.getElementById(`l1-substep-${i}`);
    if (!container) continue;

    const navHTML = `
      <div class="flex gap-2.5 pt-2">
        ${i > 1 ? `<button type="button" onclick="goToL1SubStep(${i - 1})" class="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition cursor-pointer">返回上一步</button>` : ''}
        ${i < 4 ? `<button type="button" onclick="goToL1SubStep(${i + 1})" class="${i > 1 ? 'w-2/3' : 'w-full'} bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer">
          <span>下一步：${L1_SUBSTEPS[i + 1].title}</span>
          <i class="fa-solid fa-arrow-right text-xs"></i>
        </button>` : `<button type="button" onclick="completeL1AndGoToL2()" class="${i > 1 ? 'w-2/3' : 'w-full'} bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 active:scale-[0.99] text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer">
          <i class="fa-solid fa-check text-xs"></i>
          <span>完成 L1，进入 L2 能力画像</span>
          <i class="fa-solid fa-arrow-right text-xs"></i>
        </button>`}
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', navHTML);
  }
}

/**
 * Inject L2 sub-step progress indicators and navigation
 */
function injectL2SubStepUI() {
  const step2Card = document.getElementById('step2-card');
  if (!step2Card) return;

  const header = step2Card.querySelector('.border-b');
  if (!header) return;

  const progressHTML = `
    <div class="flex items-center justify-between text-xs mt-4 pt-4 border-t border-slate-100">
      ${Object.keys(L2_SUBSTEPS).map(i => `
        <button type="button" onclick="goToL2SubStep(${i})" id="l2SubTab${i}" 
          class="flex items-center gap-1.5 font-bold ${i == 1 ? 'text-teal-700' : 'text-slate-400'} cursor-pointer transition-colors">
          <span id="l2SubIcon${i}" class="w-5 h-5 rounded-full ${i == 1 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'} flex items-center justify-center text-[10px] font-bold transition-all">${i}</span>
          <span class="hidden sm:inline">${L2_SUBSTEPS[i].title}</span>
        </button>
        ${i < 3 ? '<div class="flex-1 h-0.5 bg-slate-200 mx-1.5 relative"><div id="l2SubProgress' + i + '" class="h-full bg-teal-600 transition-all w-0"></div></div>' : ''}
      `).join('')}
    </div>
  `;

  header.insertAdjacentHTML('afterend', progressHTML);

  organizeL2Fields();
}

/**
 * Organize L2 fields into substep containers
 */
function organizeL2Fields() {
  const step2Card = document.getElementById('step2-card');
  if (!step2Card) return;

  const allChildren = Array.from(step2Card.children);
  const progressIdx = allChildren.findIndex(el => el.querySelector('#l2SubTab1'));
  if (progressIdx < 0) return;

  const contentChildren = allChildren.slice(progressIdx + 1);

  // Create substep containers
  for (let i = 1; i <= 3; i++) {
    const container = document.createElement('div');
    container.id = `l2-substep-${i}`;
    container.className = `space-y-4 ${i === 1 ? '' : 'hidden'}`;
    container.setAttribute('data-substep', i);
    step2Card.appendChild(container);
  }

  // Distribute fields
  contentChildren.forEach(child => {
    if (!child || !child.nodeType || child.nodeType !== 1) return;
    
    const html = child.outerHTML || '';
    const text = child.textContent || '';
    
    let targetSubstep = 1; // default
    
    // Substep 1: Subjects and grades
    if (html.includes('name="subject"') || html.includes('id="customSubjectsList"') ||
        text.includes('授课科目') || text.includes('年级') || text.includes('科目') ||
        (html.includes('type="checkbox"') && text.includes('数学'))) {
      targetSubstep = 1;
    }
    // Substep 2: Rate and style
    else if (html.includes('id="hourlyRate"') || html.includes('id="scoreHighlight"') || 
             html.includes('id="styleTagContainer"') ||
             text.includes('课时费') || text.includes('风格') || text.includes('时薪')) {
      targetSubstep = 2;
    }
    // Substep 3: Lecture materials and availability
    else if (html.includes('id="lectureUrl"') || html.includes('id="uploadedFilesList"') || 
             html.includes('id="availabilitySection"') || html.includes('id="fileUploadInput"') ||
             text.includes('试讲') || text.includes('素材') || text.includes('空闲时段') || text.includes('上传')) {
      targetSubstep = 3;
    }
    
    const targetContainer = document.getElementById(`l2-substep-${targetSubstep}`);
    if (targetContainer && child.parentNode === step2Card) {
      targetContainer.appendChild(child);
    }
  });

  addL2SubStepNavigation();
}

/**
 * Add navigation buttons to L2 substeps
 */
function addL2SubStepNavigation() {
  for (let i = 1; i <= 3; i++) {
    const container = document.getElementById(`l2-substep-${i}`);
    if (!container) continue;

    const navHTML = `
      <div class="flex gap-2.5 pt-2">
        ${i > 1 ? `<button type="button" onclick="goToL2SubStep(${i - 1})" class="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition cursor-pointer">返回上一步</button>` : ''}
        ${i < 3 ? `<button type="button" onclick="goToL2SubStep(${i + 1})" class="${i > 1 ? 'w-2/3' : 'w-full'} bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer">
          <span>下一步：${L2_SUBSTEPS[i + 1].title}</span>
          <i class="fa-solid fa-arrow-right text-xs"></i>
        </button>` : `<button type="button" onclick="completeL2AndSubmit()" class="${i > 1 ? 'w-2/3' : 'w-full'} bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:scale-[0.99] text-white font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer">
          <i class="fa-solid fa-sparkles text-xs"></i>
          <span>完成配置，提交入库审核</span>
        </button>`}
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', navHTML);
  }
}

/**
 * Navigate to L1 sub-step
 */
function goToL1SubStep(step) {
  if (step < 1 || step > 4) return;
  
  currentL1SubStep = step;

  // Hide all substeps
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`l1-substep-${i}`);
    if (el) el.classList.toggle('hidden', i !== step);
  }

  // Update progress indicators
  for (let i = 1; i <= 4; i++) {
    const tab = document.getElementById(`l1SubTab${i}`);
    const icon = document.getElementById(`l1SubIcon${i}`);
    
    if (i < step) {
      // Completed step
      if (tab) {
        tab.className = 'flex items-center gap-1.5 font-bold text-teal-700 cursor-pointer transition-colors';
      }
      if (icon) {
        icon.className = 'w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold transition-all';
        icon.innerHTML = '<i class="fa-solid fa-check"></i>';
      }
      const progress = document.getElementById(`l1SubProgress${i}`);
      if (progress) progress.style.width = '100%';
    } else if (i === step) {
      // Current step
      if (tab) {
        tab.className = 'flex items-center gap-1.5 font-bold text-teal-700 cursor-pointer transition-colors';
      }
      if (icon) {
        icon.className = 'w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold transition-all';
        icon.textContent = i;
      }
    } else {
      // Future step
      if (tab) {
        tab.className = 'flex items-center gap-1.5 font-bold text-slate-400 cursor-pointer transition-colors';
      }
      if (icon) {
        icon.className = 'w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold transition-all';
        icon.textContent = i;
      }
    }
  }

  // Scroll to top of card
  document.getElementById('step1-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Save state
  saveMentorWizardState();
}

/**
 * Navigate to L2 sub-step
 */
function goToL2SubStep(step) {
  if (step < 1 || step > 3) return;
  
  currentL2SubStep = step;

  // Hide all substeps
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`l2-substep-${i}`);
    if (el) el.classList.toggle('hidden', i !== step);
  }

  // Update progress indicators
  for (let i = 1; i <= 3; i++) {
    const tab = document.getElementById(`l2SubTab${i}`);
    const icon = document.getElementById(`l2SubIcon${i}`);
    
    if (i < step) {
      // Completed
      if (tab) tab.className = 'flex items-center gap-1.5 font-bold text-teal-700 cursor-pointer transition-colors';
      if (icon) {
        icon.className = 'w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold transition-all';
        icon.innerHTML = '<i class="fa-solid fa-check"></i>';
      }
      const progress = document.getElementById(`l2SubProgress${i}`);
      if (progress) progress.style.width = '100%';
    } else if (i === step) {
      // Current
      if (tab) tab.className = 'flex items-center gap-1.5 font-bold text-teal-700 cursor-pointer transition-colors';
      if (icon) {
        icon.className = 'w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold transition-all';
        icon.textContent = i;
      }
    } else {
      // Future
      if (tab) tab.className = 'flex items-center gap-1.5 font-bold text-slate-400 cursor-pointer transition-colors';
      if (icon) {
        icon.className = 'w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold transition-all';
        icon.textContent = i;
      }
    }
  }

  // Ensure availability picker is created for step 3
  if (step === 3) {
    try {
      if (typeof ensureOnboardAvailabilityPicker === 'function') {
        ensureOnboardAvailabilityPicker();
      }
    } catch (e) {
      console.warn('Availability picker init failed:', e);
    }
  }

  document.getElementById('step2-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  saveMentorWizardState();
}

/**
 * Complete L1 and advance to L2
 */
function completeL1AndGoToL2() {
  // Validate all L1 substeps
  for (let i = 1; i <= 4; i++) {
    if (!L1_SUBSTEPS[i].validator()) {
      if (typeof showToast === 'function') {
        showToast(`请先完成【${L1_SUBSTEPS[i].title}】的必填信息`, 'warning');
      }
      goToL1SubStep(i);
      return;
    }
  }

  // Save draft
  if (typeof persistMentorDraft === 'function') {
    persistMentorDraft(false);
  }

  if (typeof showToast === 'function') {
    showToast('L1 资质已保存，进入 L2 能力画像');
  }

  // Call the existing goToStep function if available
  if (typeof goToStep === 'function') {
    goToStep(2);
  }
}

/**
 * Complete L2 and submit
 */
function completeL2AndSubmit() {
  // Validate all L2 substeps
  for (let i = 1; i <= 3; i++) {
    if (!L2_SUBSTEPS[i].validator()) {
      if (typeof showToast === 'function') {
        showToast(`请先完成【${L2_SUBSTEPS[i].title}】的必填信息`, 'warning');
      }
      goToL2SubStep(i);
      return;
    }
  }

  // Call the existing submit function
  if (typeof submitMentorProfile === 'function') {
    submitMentorProfile();
  }
}

/**
 * Field change listener for auto-save and auto-advance
 */
function onL1FieldChange() {
  // Refresh preview gate
  if (typeof refreshMentorPreviewGate === 'function') {
    refreshMentorPreviewGate();
  }

  // Check current substep validity
  const isValid = L1_SUBSTEPS[currentL1SubStep]?.validator();
  
  // Update validity state
  l1SubStepValid[currentL1SubStep - 1] = isValid;

  // Auto-save
  if (__l1SubTimer) clearTimeout(__l1SubTimer);
  __l1SubTimer = setTimeout(() => {
    if (typeof persistMentorDraft === 'function') {
      persistMentorDraft(false);
    }
  }, 500);

  // Auto-advance if valid and not locked
  if (isValid && !__l1SubAutoLock && !window.__restoringMentorDraft && currentL1SubStep < 4) {
    __l1SubAutoLock = true;
    if (typeof showToast === 'function') {
      showToast(`${L1_SUBSTEPS[currentL1SubStep].title}已保存`);
    }
    setTimeout(() => {
      goToL1SubStep(currentL1SubStep + 1);
      __l1SubAutoLock = false;
    }, 400);
  }
}

function onL2FieldChange() {
  if (typeof refreshMentorPreviewGate === 'function') {
    refreshMentorPreviewGate();
  }

  const isValid = L2_SUBSTEPS[currentL2SubStep]?.validator();
  l2SubStepValid[currentL2SubStep - 1] = isValid;

  if (__l2SubTimer) clearTimeout(__l2SubTimer);
  __l2SubTimer = setTimeout(() => {
    if (typeof persistMentorDraft === 'function') {
      persistMentorDraft(false);
    }
  }, 500);

  if (isValid && !__l2SubAutoLock && !window.__restoringMentorDraft && currentL2SubStep < 3) {
    __l2SubAutoLock = true;
    if (typeof showToast === 'function') {
      showToast(`${L2_SUBSTEPS[currentL2SubStep].title}已保存`);
    }
    setTimeout(() => {
      goToL2SubStep(currentL2SubStep + 1);
      __l2SubAutoLock = false;
    }, 400);
  }
}

/**
 * Bind field change listeners
 */
function bindFieldChangeListeners() {
  // L1 fields
  const l1Fields = ['realName', 'phone', 'idCard', 'chsiCode', 'bankCardNumber'];
  l1Fields.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.getAttribute('data-wizard-bound')) {
      el.addEventListener('input', onL1FieldChange);
      el.setAttribute('data-wizard-bound', '1');
    }
  });

  // L1 checkboxes
  ['nonPublicTeacherAgree', 'privacyAuthAgree'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.getAttribute('data-wizard-bound')) {
      el.addEventListener('change', onL1FieldChange);
      el.setAttribute('data-wizard-bound', '1');
    }
  });

  // L1 university selects
  ['provinceSelect', 'universitySelect', 'manualUniversityInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.getAttribute('data-wizard-bound')) {
      el.addEventListener('change', onL1FieldChange);
      el.addEventListener('input', onL1FieldChange);
      el.setAttribute('data-wizard-bound', '1');
    }
  });

  // L2 fields
  const l2Fields = ['hourlyRate', 'lectureUrl', 'scoreHighlight'];
  l2Fields.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.getAttribute('data-wizard-bound')) {
      el.addEventListener('input', onL2FieldChange);
      el.setAttribute('data-wizard-bound', '1');
    }
  });

  // L2 subject checkboxes
  document.querySelectorAll('input[name="subject"]').forEach(cb => {
    if (!cb.getAttribute('data-wizard-bound')) {
      cb.addEventListener('change', onL2FieldChange);
      cb.setAttribute('data-wizard-bound', '1');
    }
  });
}

/**
 * Save wizard state to draft
 */
function saveMentorWizardState() {
  try {
    const state = {
      l1SubStep: currentL1SubStep,
      l2SubStep: currentL2SubStep,
      l1SubStepValid: l1SubStepValid.slice(),
      l2SubStepValid: l2SubStepValid.slice()
    };
    localStorage.setItem('xh_mentor_wizard_state_v1', JSON.stringify(state));
  } catch (e) {
    console.warn('Wizard state save failed:', e);
  }
}

/**
 * Restore wizard state from draft
 */
function restoreWizardState() {
  try {
    const raw = localStorage.getItem('xh_mentor_wizard_state_v1');
    if (!raw) return;
    
    const state = JSON.parse(raw);
    if (state.l1SubStep) currentL1SubStep = Math.min(4, Math.max(1, state.l1SubStep));
    if (state.l2SubStep) currentL2SubStep = Math.min(3, Math.max(1, state.l2SubStep));
    if (Array.isArray(state.l1SubStepValid)) l1SubStepValid = state.l1SubStepValid.slice();
    if (Array.isArray(state.l2SubStepValid)) l2SubStepValid = state.l2SubStepValid.slice();

    // Apply substep navigation if on step 1
    const step1Card = document.getElementById('step1-card');
    if (step1Card && !step1Card.classList.contains('hidden')) {
      goToL1SubStep(currentL1SubStep);
    }

    // Apply substep navigation if on step 2
    const step2Card = document.getElementById('step2-card');
    if (step2Card && !step2Card.classList.contains('hidden')) {
      goToL2SubStep(currentL2SubStep);
    }
  } catch (e) {
    console.warn('Wizard state restore failed:', e);
  }
}

// Make functions globally accessible
window.goToL1SubStep = goToL1SubStep;
window.goToL2SubStep = goToL2SubStep;
window.completeL1AndGoToL2 = completeL1AndGoToL2;
window.completeL2AndSubmit = completeL2AndSubmit;
window.onL1FieldChange = onL1FieldChange;
window.onL2FieldChange = onL2FieldChange;
window.initMentorWizard = initMentorWizard;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMentorWizard);
} else {
  // DOM already loaded, init after a short delay to ensure other scripts are ready
  setTimeout(initMentorWizard, 100);
}
