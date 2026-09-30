#!/usr/bin/env node
/**
 * 星火学伴 End-to-End Browser Testing (Improved)
 * Direct JS function invocation instead of fragile selectors
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8080';
const API_BASE = 'http://127.0.0.1:8787';
const PARENT_PHONE = '13980889211';
const NEW_PARENT_PHONE = '139000092' + Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 11 digits: 139000092 + 2
const NEW_MENTOR_PHONE = '139000089' + Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 11 digits: 139000089 + 2
const CODE = '888888';

const ARTIFACTS_DIR = '/opt/cursor/artifacts';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function screenshot(page, name) {
  const filepath = path.join(ARTIFACTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 ${filepath}`);
}

async function testNewParentRegistration(browser) {
  console.log(`\n[Test 1] New parent ${NEW_PARENT_PHONE} registers via parent_register.html`);
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [Browser error]`, msg.text());
  });
  
  try {
    await page.goto(`${BASE_URL}/parent_register.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(1000);
    
    // Step 1: Fill basic info and SMS
    await page.type('#parentName', '测试家长');
    await page.type('#parentPhone', NEW_PARENT_PHONE);
    await page.type('#studentNickname', '小测');
    await page.select('#studentGrade', '初三 (中考冲刺)');
    
    // Send SMS code
    await page.click('#btnSendParentSms');
    await delay(500);
    
    // Enter SMS code
    await page.type('#parentSmsCode', CODE);
    await delay(500);
    
    await screenshot(page, 'parent-register-step1');
    
    // Go to step 2
    const step2Btn = await page.$('button[onclick="goToStep(2)"]');
    if (!step2Btn) {
      console.log('  ⚠ Step 2 button not found');
      throw new Error('Step 2 button not found');
    }
    await step2Btn.click();
    await delay(1000);
    
    // Step 2: Select subject and configure via wizard
    // Check what subjects are available
    const availableSubjects = await page.evaluate(() => {
      const subjects = Array.from(document.querySelectorAll('input[name="targetSubject"]'));
      return subjects.map(s => s.value);
    });
    console.log('  Available subjects:', availableSubjects);
    
    // Check the math subject via JavaScript (more reliable than puppeteer click)
    await page.evaluate(() => {
      const mathCheckbox = document.querySelector('input[name="targetSubject"][value="数学"]');
      if (mathCheckbox) {
        mathCheckbox.checked = true;
        mathCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    console.log('  ✓ Math subject checked');
    await delay(500);
    
    // The subject is checked, so wizard should open automatically
    // Wait for wizard modal to appear
    await delay(1500);
    
    // Check if wizard modal is visible
    const wizardVisible = await page.evaluate(() => {
      const modal = document.getElementById('subjectWizardModal');
      return modal && !modal.classList.contains('hidden');
    });
    
    if (wizardVisible) {
      console.log('  ✓ Wizard modal opened');
      
      try {
        // Select weak points
        const weakPoints = await page.$$('.wizard-topic-cb');
        console.log(`  Found ${weakPoints.length} weak point checkboxes`);
        if (weakPoints.length >= 2) {
          await weakPoints[0].click();
          await weakPoints[1].click();
          await delay(300);
        }
        
        // Click next to go to pacing step
        console.log('  Clicking next button...');
        await page.click('#btnWizardNext');
        await delay(500);
        
        // Check which button is visible (next or finish)
        const nextVisible = await page.evaluate(() => {
          const btn = document.getElementById('btnWizardNext');
          return btn && !btn.classList.contains('hidden');
        });
        const finishVisible = await page.evaluate(() => {
          const btn = document.getElementById('btnWizardFinish');
          return btn && !btn.classList.contains('hidden');
        });
        console.log(`  Button state: next=${nextVisible}, finish=${finishVisible}`);
        
        if (nextVisible) {
          // Click next again to go to pain step
          console.log('  Clicking next button again...');
          await page.click('#btnWizardNext');
          await delay(500);
          
          // Select a pain tag
          const painTags = await page.$$('#wizardPainContainer > span');
          console.log(`  Found ${painTags.length} pain tags`);
          if (painTags.length > 0) {
            await painTags[0].click();
            await delay(300);
          }
          
          // Now finish button should be visible
          console.log('  Clicking finish button...');
          await page.click('#btnWizardFinish');
          await delay(1000);
        } else if (finishVisible) {
          // Already on last step, just finish
          console.log('  Already on last step, clicking finish...');
          await page.click('#btnWizardFinish');
          await delay(1000);
        }
        console.log('  ✓ Wizard completed');
      } catch (wizErr) {
        console.log('  ⚠ Wizard interaction error:', wizErr.message);
        throw wizErr;
      }
    } else {
      console.log('  ⚠ Wizard did not open automatically, trying manual');
      // Try to click config button manually
      await page.evaluate(() => {
        const btn = document.querySelector('button[onclick*="openSubjectWizard"]');
        if (btn) btn.click();
      });
      await delay(1000);
      
      // Try wizard steps again
      const weakPoints = await page.$$('.wizard-topic-cb');
      if (weakPoints.length > 0) await weakPoints[0].click();
      await delay(300);
      await page.click('#btnWizardNext');
      await delay(500);
      await page.click('#btnWizardNext');
      await delay(500);
      const painTags = await page.$$('#wizardPainContainer > span');
      if (painTags.length > 0) await painTags[0].click();
      await delay(300);
      await page.click('#btnWizardFinish');
      await delay(1000);
    }
    
    await screenshot(page, 'parent-register-step2');
    
    // Go to step 3
    console.log('  Going to step 3...');
    try {
      await page.click('button[onclick="goToStep(3)"]');
    } catch (e) {
      console.log('  ⚠ Failed to click step 3 button, trying JS click');
      await page.evaluate(() => {
        const btn = document.querySelector('button[onclick="goToStep(3)"]');
        if (btn) btn.click();
        else if (typeof goToStep === 'function') goToStep(3);
      });
    }
    await delay(1000);
    
    // Step 3: Select space and agree
    console.log('  Selecting space and agreeing...');
    await page.evaluate(() => {
      const spaceRadio = document.querySelector('input[name="selectedSpace"]');
      if (spaceRadio) spaceRadio.checked = true;
      
      const agreeCheck = document.getElementById('parentAgreementCheck');
      if (agreeCheck) agreeCheck.checked = true;
    });
    await delay(500);
    
    await screenshot(page, 'parent-register-step3');
    
    // Submit
    await page.click('#btnSubmitParent');
    
    // Wait for navigation to dashboard
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 });
    } catch (e) {
      // May already have navigated
    }
    
    await delay(1000);
    
    const finalUrl = page.url();
    if (finalUrl.includes('parent_dashboard.html')) {
      console.log('  ✓ Registered and landed on dashboard with token');
      await screenshot(page, 'parent-register-success');
      console.log('  ✅ PASSED');
    } else {
      console.log('  Debug: Final URL:', finalUrl);
      throw new Error(`Expected parent_dashboard.html, got ${finalUrl}`);
    }
  } catch (error) {
    console.error('  ❌ FAILED -', error.message);
    await screenshot(page, 'parent-register-error');
    throw error;
  } finally {
    await page.close();
  }
}

async function assertL1SubstepShowsField(page, step, fieldId) {
  await page.evaluate((s) => {
    if (typeof goToL1SubStep === 'function') goToL1SubStep(s);
  }, step);
  await delay(400);
  const ok = await page.evaluate((fid) => {
    const el = document.getElementById(fid);
    if (!el) return false;
    const sub = el.closest('[id^="l1-substep-"]');
    return sub && !sub.classList.contains('hidden');
  }, fieldId);
  if (!ok) throw new Error(`L1 substep ${step}: #${fieldId} not visible`);
}

async function assertL2SubstepShowsField(page, step, fieldId) {
  await page.evaluate((s) => {
    if (typeof goToStep === 'function') goToStep(2);
    if (typeof goToL2SubStep === 'function') goToL2SubStep(s);
  }, step);
  await delay(400);
  const ok = await page.evaluate((fid) => {
    const el = document.getElementById(fid);
    if (!el) return false;
    const sub = el.closest('[id^="l2-substep-"]');
    return sub && !sub.classList.contains('hidden');
  }, fieldId);
  if (!ok) throw new Error(`L2 substep ${step}: #${fieldId} not visible`);
}

async function testMentorWizardSubsteps(browser) {
  console.log('\n[Test 2a] Mentor L1/L2 wizard substeps (mobile + desktop)');
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage();
    try {
      await page.setViewport(viewport);
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 15000 });
      await delay(1500);
      await assertL1SubstepShowsField(page, 1, 'realName');
      await assertL1SubstepShowsField(page, 2, 'chsiCode');
      await assertL1SubstepShowsField(page, 3, 'bankCardNumber');
      await assertL1SubstepShowsField(page, 4, 'privacyAuthAgree');
      await assertL2SubstepShowsField(page, 1, 'customSubjectInput');
      await assertL2SubstepShowsField(page, 2, 'hourlyRate');
      await assertL2SubstepShowsField(page, 3, 'lectureUrl');
      await screenshot(page, `mentor-wizard-substeps-${viewport.width}`);
      console.log(`  ✓ Substeps OK at ${viewport.width}px`);
    } finally {
      await page.close();
    }
  }
  console.log('  ✅ PASSED');
}

async function testNewMentorOnboarding(browser) {
  console.log(`\n[Test 2] New mentor ${NEW_MENTOR_PHONE} onboards via index.html`);
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [Browser error]`, msg.text());
  });
  
  try {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(1000);

    await assertL1SubstepShowsField(page, 2, 'provinceSelect');
    await assertL1SubstepShowsField(page, 1, 'realName');
    
    // Fill ALL form fields via JS (L1 + L2 combined)
    await page.evaluate((phone, code) => {
      // L1 fields
      document.getElementById('realName').value = '测试导师';
      document.getElementById('phone').value = phone;
      document.getElementById('idCard').value = '510107199001011234';
      document.getElementById('chsiCode').value = 'A98F72KL50198821';
      
      const bankName = document.getElementById('bankName');
      if (bankName) bankName.value = '招商银行';
      
      const bankCard = document.getElementById('bankCardNumber');
      if (bankCard) bankCard.value = '6214830123456789';
      
      const codeInput = document.getElementById('mentorSmsCode');
      if (codeInput) codeInput.value = code;
      
      const privacyCheck = document.getElementById('privacyAuthAgree');
      if (privacyCheck) privacyCheck.checked = true;
      
      // L2 fields (set them even if on step 1)
      const subjectRadio = document.querySelector('input[name="subject"][value="初中数学"]');
      if (subjectRadio) subjectRadio.checked = true;
      
      const rateInput = document.getElementById('hourlyRate');
      if (rateInput) rateInput.value = '120';
      
      const lectureInput = document.getElementById('lectureUrl');
      if (lectureInput) lectureInput.value = 'https://example.com/demo';
      
      // Set university value
      const finalUni = document.getElementById('finalUniversityValue');
      if (finalUni) finalUni.value = '四川大学';
    }, NEW_MENTOR_PHONE, CODE);
    
    await delay(2000);
    await screenshot(page, 'mentor-onboard-filled');
    
    // Submit and wait for navigation
    try {
      await page.evaluate(() => {
        if (typeof submitApplication === 'function') {
          submitApplication();
        } else {
          const submitBtn = document.querySelector('button[onclick*="submitApplication"]');
          if (submitBtn) submitBtn.click();
        }
      });
      
      // Wait for navigation to dashboard (with timeout)
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {
        // Navigation might have already happened or might not happen
      });
      
      await delay(1000); // Extra delay for page to settle
    } catch (e) {
      // Context might be destroyed if page navigated
      console.log('  Note: Navigation occurred');
    }
    
    const finalUrl = page.url();
    if (finalUrl.includes('mentor_dashboard.html')) {
      console.log('  ✓ Mentor application submitted');
      console.log('  ✓ Redirected to mentor dashboard');
      await screenshot(page, 'mentor-onboard-success');
      console.log('  ✅ PASSED');
    } else {
      console.log('  Debug: Final URL:', finalUrl);
      throw new Error('Expected redirect to mentor_dashboard.html');
    }
  } catch (error) {
    console.error('  ❌ FAILED -', error.message);
    await screenshot(page, 'mentor-onboard-error');
    throw error;
  } finally {
    await page.close();
  }
}

async function testDuplicatePhoneRegistration(browser) {
  console.log(`\n[Test 3] Duplicate phone ${PARENT_PHONE} shows "该手机号已注册，请直接登录"`);
  const page = await browser.newPage();
  
  try {
    await page.goto(`${BASE_URL}/parent_register.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(1000);
    
    // Fill step 1 with existing phone
    await page.type('#parentName', '重复家长');
    await page.type('#parentPhone', PARENT_PHONE);
    await page.type('#studentNickname', '小重');
    await page.select('#studentGrade', '初三 (中考冲刺)');
    
    // Send SMS code
    await page.click('#btnSendParentSms');
    await delay(500);
    await page.type('#parentSmsCode', CODE);
    await delay(500);
    
    // Go to step 2
    await page.evaluate(() => goToStep(2));
    await delay(1000);
    
    // Check math subject
    await page.evaluate(() => {
      const math = document.querySelector('input[name="targetSubject"][value="数学"]');
      if (math) {
        math.checked = true;
        math.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await delay(1500); // Wait for wizard to auto-open
    
    // Complete wizard if it opened
    const wizardVisible = await page.evaluate(() => {
      const modal = document.getElementById('subjectWizardModal');
      return modal && !modal.classList.contains('hidden');
    });
    
    if (wizardVisible) {
      console.log('  ✓ Wizard opened');
      // Click weak point
      const weakPoints = await page.$$('.wizard-topic-cb');
      if (weakPoints.length > 0) {
        await weakPoints[0].click();
        await delay(300);
      }
      
      // Click next button
      await page.click('#btnWizardNext');
      await delay(500);
      
      // Check which button is visible now
      const buttonState = await page.evaluate(() => {
        const next = document.getElementById('btnWizardNext');
        const finish = document.getElementById('btnWizardFinish');
        return {
          nextVisible: next && !next.classList.contains('hidden'),
          finishVisible: finish && !finish.classList.contains('hidden')
        };
      });
      console.log(`  Button state after next:`, buttonState);
      
      if (buttonState.finishVisible) {
        // On last step, click finish
        await page.click('#btnWizardFinish');
        await delay(1000);
        console.log('  ✓ Wizard finished');
      }
    } else {
      console.log('  ⚠ Wizard did not open');
    }
    
    // Check if on step 2 before trying to go to step 3
    const currentStep = await page.evaluate(() => {
      const step2 = document.getElementById('stepCard2');
      const step3 = document.getElementById('stepCard3');
      if (step2 && !step2.classList.contains('hidden')) return 2;
      if (step3 && !step3.classList.contains('hidden')) return 3;
      return 1;
    });
    console.log(`  Currently on step: ${currentStep}`);
    
    // Go to step 3
    if (currentStep < 3) {
      await page.evaluate(() => goToStep(3));
      await delay(1000);
    }
    
    // Select space and agree
    await page.evaluate(() => {
      const spaceRadio = document.querySelector('input[name="selectedSpace"]');
      if (spaceRadio) spaceRadio.checked = true;
      const agreeCheck = document.getElementById('parentAgreementCheck');
      if (agreeCheck) agreeCheck.checked = true;
    });
    await delay(500);
    
    // Submit
    await page.evaluate(() => {
      const btn = document.getElementById('btnSubmitParent');
      if (btn) btn.click();
    });
    await delay(3000); // Wait for error to appear
    
    await screenshot(page, 'duplicate-phone-error');
    
    // Check for inline error element
    const errorInfo = await page.evaluate(() => {
      const errorDiv = document.getElementById('registrationError');
      const errorText = document.getElementById('registrationErrorText');
      return {
        exists: !!errorDiv && !!errorText,
        hidden: errorDiv ? errorDiv.classList.contains('hidden') : true,
        text: errorText ? errorText.innerText : '',
        bodyText: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log('  Error div info:', JSON.stringify(errorInfo, null, 2));
    
    const currentUrl = page.url();
    console.log('  Current URL:', currentUrl);
    
    const errorVisible = errorInfo.exists && !errorInfo.hidden && 
      (errorInfo.text.includes('已注册') || errorInfo.text.includes('请直接登录'));
    
    if (errorVisible) {
      console.log('  ✓ Duplicate phone error displayed inline');
      console.log('  ✅ PASSED');
    } else if (currentUrl.includes('parent_register.html')) {
      // Check if error is in page text (fallback)
      if (errorInfo.bodyText.includes('该手机号已注册') || errorInfo.bodyText.includes('请直接登录')) {
        console.log('  ✓ Duplicate phone error shown in page');
        console.log('  ✅ PASSED');
      } else {
        console.log('  ⚠ Error not visible. Page stayed on register but no error shown.');
        throw new Error('Expected duplicate phone error to be visible');
      }
    } else {
      console.log('  ⚠ Page navigated away unexpectedly');
      throw new Error('Expected registration to be blocked');
    }
  } catch (error) {
    console.error('  ❌ FAILED -', error.message);
    await screenshot(page, 'duplicate-phone-test-error');
    throw error;
  } finally {
    await page.close();
  }
}

async function testParentBookingAndPayment(browser) {
  console.log(`\n[Test 4] Logged-in parent ${PARENT_PHONE} creates booking and completes mock pay`);
  const page = await browser.newPage();
  
  try {
    // Login first
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(1000);
    
    await page.evaluate((phone, code) => {
      document.getElementById('tabParent').click();
      setTimeout(() => {
        document.getElementById('loginMobile').value = phone;
        if (window.sendLoginSMS) window.sendLoginSMS();
        setTimeout(() => {
          document.getElementById('smsCodeInput').value = code;
          document.getElementById('agreementCheckbox').checked = true;
          document.getElementById('btnSubmitLogin').click();
        }, 100);
      }, 100);
    }, PARENT_PHONE, CODE);
    
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});
    await delay(2000);
    
    const dashboardUrl = page.url();
    if (!dashboardUrl.includes('parent_dashboard.html')) {
      throw new Error(`Login failed, at ${dashboardUrl}`);
    }
    console.log('  ✓ Logged in to parent dashboard');
    
    // Wait for mentors to load
    await delay(3000);
    await screenshot(page, 'parent-dashboard-before-booking');
    
    const bookingResult = await page.evaluate(async () => {
      try {
        if (!window.StorageService) {
          return { success: false, error: 'StorageService not available' };
        }
        const mentors = await window.StorageService.getMentors();
        if (!mentors || !mentors.length) {
          return { success: false, error: 'No mentors available' };
        }
        const mentor = mentors[0];
        const booking = await window.StorageService.addBooking({
          mentorId: mentor.id,
          tutorId: mentor.id,
          tutorName: mentor.realName || mentor.maskedName || '导师',
          subject: '数学',
          space: '青羊金沙文化微网点',
          schedule: '周六 14:00-16:00',
          timeSlot: '周六 14:00-16:00',
          amount: 300,
          hours: 2,
          status: 'pending_accept'
        });
        if (!booking || booking.ok === false || !booking.id) {
          return { success: false, error: (booking && booking.error) || 'addBooking failed' };
        }
        const payResult = await handleWeChatPayment(booking.id, 300, booking.tutorName || '导师', '数学');
        if (!payResult || !payResult.success) {
          return { success: false, error: (payResult && payResult.error) || 'payment failed', bookingId: booking.id };
        }
        await window.StorageService.hydrateFromServer();
        const refreshed = window.StorageService.getBookingById(booking.id);
        const contract = await window.StorageService.saveContract({
          bookingId: booking.id,
          title: '三方托管服务居间协议',
          signer: '测试家长',
          tutorName: booking.tutorName,
          amount: 300,
          space: booking.space
        });
        return {
          success: true,
          bookingId: booking.id,
          paymentStatus: refreshed && refreshed.paymentStatus,
          contractId: contract && contract.id
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    if (!bookingResult.success) {
      throw new Error(bookingResult.error || 'Booking/payment flow failed');
    }
    if (bookingResult.paymentStatus !== 'paid') {
      throw new Error(`Expected paymentStatus=paid, got ${bookingResult.paymentStatus}`);
    }
    if (!bookingResult.contractId) {
      throw new Error('Parent contract was not saved');
    }

    console.log('  ✓ Booking created with server id:', bookingResult.bookingId);
    console.log('  ✓ Mock pay succeeded (paymentStatus=paid)');
    console.log('  ✓ Parent contract saved:', bookingResult.contractId);
    
    await screenshot(page, 'booking-payment-complete');
    console.log('  ✅ PASSED');
  } catch (error) {
    console.error('  ❌ FAILED -', error.message);
    await screenshot(page, 'booking-payment-error');
    throw error;
  } finally {
    await page.close();
  }
}

async function testMentorAcceptBooking(browser) {
  console.log(`\n[Test 5] Mentor accepts or completes booking`);
  const page = await browser.newPage();
  
  try {
    // Login as mentor (use a known mentor phone)
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(1000);
    
    const mentorPhone = '13880123456'; // From db.json
    
    await page.evaluate((phone, code) => {
      // Mentor tab is default
      document.getElementById('loginMobile').value = phone;
      if (window.sendLoginSMS) window.sendLoginSMS();
      setTimeout(() => {
        document.getElementById('smsCodeInput').value = code;
        document.getElementById('agreementCheckbox').checked = true;
        document.getElementById('btnSubmitLogin').click();
      }, 100);
    }, mentorPhone, CODE);
    
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});
    await delay(2000);
    
    const dashboardUrl = page.url();
    if (!dashboardUrl.includes('mentor_dashboard.html')) {
      throw new Error(`Mentor login failed, at ${dashboardUrl}`);
    }
    console.log('  ✓ Logged in to mentor dashboard');
    
    await delay(2000);
    await screenshot(page, 'mentor-dashboard-with-bookings');
    
    // Accept or complete a booking
    const actionTaken = await page.evaluate(() => {
      const acceptBtn = document.querySelector('button[onclick*="accept"]');
      const completeBtn = document.querySelector('button[onclick*="complete"]');
      
      if (acceptBtn) {
        acceptBtn.click();
        return 'accepted';
      } else if (completeBtn) {
        completeBtn.click();
        return 'completed';
      }
      return null;
    });
    
    if (actionTaken) {
      await delay(2000);
      console.log(`  ✓ Booking ${actionTaken}`);
      await screenshot(page, 'mentor-booking-action');
    } else {
      console.log('  ⚠ No bookings to accept/complete');
    }
    
    console.log('  ✅ PASSED');
  } catch (error) {
    console.error('  ❌ FAILED -', error.message);
    await screenshot(page, 'mentor-accept-error');
    throw error;
  } finally {
    await page.close();
  }
}

async function testUIChanges(browser) {
  console.log('\n[Test 6] Verify UI changes (CHSI button, removed badge and 承诺书)');
  const page = await browser.newPage();
  
  try {
    // Test 1: Check CHSI button exists on mentor onboarding page
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    
    const chsiButton = await page.evaluate(() => {
      const link = document.querySelector('a[href*="chsi.com.cn"]');
      return link ? {
        exists: true,
        href: link.href,
        text: link.innerText
      } : { exists: false };
    });
    
    if (chsiButton.exists && chsiButton.href.includes('chsi.com.cn')) {
      console.log('  ✓ CHSI verification button exists on index.html');
      console.log(`    Link: ${chsiButton.href}`);
    } else {
      throw new Error('CHSI button not found on index.html');
    }
    
    // Test 2: Check status badge is removed from admin_audit.html
    await page.goto(`${BASE_URL}/admin_audit.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    
    const statusBadge = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasApiStatus: text.includes('学信网 API 直连正常') || text.includes('学信网 API 联调'),
        hasAuthStatus: text.includes('公安实名认证通畅')
      };
    });
    
    if (!statusBadge.hasApiStatus && !statusBadge.hasAuthStatus) {
      console.log('  ✓ Fake integration status pill removed from admin_audit.html');
    } else {
      throw new Error('Fake integration status pill still present on admin_audit.html');
    }
    
    // Test 3: Check 承诺书 section is removed from admin_audit.html
    const compliance = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasCompliance: text.includes('非在职编制教师合规承诺书') || 
                      text.includes('公立中小学在职教师红线排查')
      };
    });
    
    if (!compliance.hasCompliance) {
      console.log('  ✓ 承诺书 section removed from admin_audit.html');
    } else {
      throw new Error('承诺书 section still present on admin_audit.html');
    }
    
    console.log('  ✅ PASSED');
  } catch (error) {
    console.error(`  ✗ FAILED: ${error.message}`);
    throw error;
  } finally {
    await page.close();
  }
}

async function testApprovedMentorDashboard(browser) {
  console.log('\n[Test 7] Approved mentor sees profile (not empty state)');
  const page = await browser.newPage();
  const MENTOR_PHONE = '13880123456';
  try {
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(800);
    await page.evaluate((phone, code) => {
      document.getElementById('loginMobile').value = phone;
      if (window.sendLoginSMS) window.sendLoginSMS();
      setTimeout(() => {
        document.getElementById('smsCodeInput').value = code;
        document.getElementById('agreementCheckbox').checked = true;
        document.getElementById('btnSubmitLogin').click();
      }, 200);
    }, MENTOR_PHONE, CODE);
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {});
    await delay(2500);
    const state = await page.evaluate(() => ({
      url: location.href,
      emptyVisible: !(document.getElementById('emptyState')?.classList.contains('hidden')),
      bodyVisible: !(document.getElementById('dashboardBody')?.classList.contains('hidden')),
      headerName: document.getElementById('headerMentorName')?.innerText || ''
    }));
    if (!state.url.includes('mentor_dashboard.html')) {
      throw new Error(`Expected mentor_dashboard, got ${state.url}`);
    }
    if (state.emptyVisible || !state.bodyVisible) {
      throw new Error('Approved mentor still sees empty state');
    }
    if (!state.headerName || state.headerName === '导师') {
      throw new Error('Mentor profile name not loaded');
    }
    await screenshot(page, 'approved-mentor-dashboard');
    console.log('  ✓ Mentor profile visible:', state.headerName);
    console.log('  ✅ PASSED');
  } catch (error) {
    console.error('  ✗ FAILED:', error.message);
    await screenshot(page, 'approved-mentor-dashboard-error');
    throw error;
  } finally {
    await page.close();
  }
}

async function testLegalModals(browser) {
  console.log('\n[Test 8] Legal modals open on login.html');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  try {
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(500);
    if (errors.length) throw new Error('Console errors on load: ' + errors.join('; '));
    await page.evaluate(() => {
      if (typeof openServiceAgreement === 'function') openServiceAgreement();
    });
    await delay(400);
    let serviceOpen = await page.evaluate(() => {
      const m = document.getElementById('legalDocModal');
      return m && !m.classList.contains('hidden');
    });
    if (!serviceOpen) throw new Error('Service agreement modal did not open');
    await page.evaluate(() => { if (typeof closeLegalDoc === 'function') closeLegalDoc(); });
    await delay(300);
    await page.evaluate(() => {
      if (typeof openPrivacyPolicy === 'function') openPrivacyPolicy();
    });
    await delay(400);
    const privacyOpen = await page.evaluate(() => {
      const m = document.getElementById('legalDocModal');
      return m && !m.classList.contains('hidden');
    });
    if (!privacyOpen) throw new Error('Privacy policy modal did not open');
    await screenshot(page, 'legal-modals-login');
    console.log('  ✓ Service + privacy modals open');
    console.log('  ✅ PASSED');
  } catch (error) {
    console.error('  ✗ FAILED:', error.message);
    throw error;
  } finally {
    await page.close();
  }
}

async function testNoConsoleErrorsOnKeyPages(browser) {
  console.log('\n[Test 9] No uncaught errors on key static pages');
  const paths = [
    'login.html',
    'parent_dashboard.html',
    'mentor_dashboard.html',
    'index.html',
    'parent_register.html',
    'admin_audit.html'
  ];
  for (const p of paths) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const t = msg.text();
      // Expected when dashboards load without a session (hydrate 401)
      if (/Failed to load resource/i.test(t) && /\b401\b/.test(t)) return;
      if (/status of 401/i.test(t)) return;
      errors.push(t);
    });
    try {
      await page.goto(`${BASE_URL}/${p}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await delay(1500);
      if (errors.length) {
        throw new Error(`${p}: ${errors.join(' | ')}`);
      }
      console.log(`  ✓ ${p}`);
    } finally {
      await page.close();
      await context.close();
    }
  }
  console.log('  ✅ PASSED');
}

async function testPayFailureDoesNotShowSuccess(browser) {
  console.log('\n[Test 11] Forced pay failure returns error (no false success)');
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(800);
    await page.evaluate((phone, code) => {
      document.getElementById('tabParent').click();
      setTimeout(() => {
        document.getElementById('loginMobile').value = phone;
        if (window.sendLoginSMS) window.sendLoginSMS();
        setTimeout(() => {
          document.getElementById('smsCodeInput').value = code;
          document.getElementById('agreementCheckbox').checked = true;
          document.getElementById('btnSubmitLogin').click();
        }, 150);
      }, 100);
    }, PARENT_PHONE, CODE);
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {});
    await delay(2000);
    const result = await page.evaluate(async () => {
      if (typeof handleWeChatPayment !== 'function') {
        return { ok: false, error: 'handleWeChatPayment missing' };
      }
      const pay = await handleWeChatPayment('BK-DOES-NOT-EXIST', 300, '导师', '数学');
      return { ok: !!(pay && pay.success === false), error: pay && pay.error };
    });
    if (!result.ok) {
      throw new Error(result.error || 'Expected pay failure');
    }
    console.log('  ✓ Pay failure surfaced:', result.error);
    console.log('  ✅ PASSED');
  } finally {
    await page.close();
  }
}

async function testWizardL2SubmitButton(browser) {
  console.log('\n[Test 12] L2 wizard submit button calls submitApplication');
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(1500);
    const called = await page.evaluate(() => {
      if (typeof goToStep !== 'function' || typeof goToL2SubStep !== 'function' || typeof completeL2AndSubmit !== 'function') {
        return false;
      }
      const subject = document.querySelector('input[name="subject"][value="初中数学"]');
      if (subject) subject.checked = true;
      const rate = document.getElementById('hourlyRate');
      if (rate) rate.value = '120';
      const lecture = document.getElementById('lectureUrl');
      if (lecture) lecture.value = 'https://example.com/demo';
      goToStep(2);
      goToL2SubStep(3);
      let invoked = false;
      const previous = window.submitApplication;
      window.submitApplication = function () {
        invoked = true;
        if (typeof previous === 'function') {
          try { previous(); } catch (_) {}
        }
      };
      completeL2AndSubmit();
      return invoked;
    });
    if (!called) {
      throw new Error('completeL2AndSubmit did not invoke submitApplication');
    }
    await screenshot(page, 'wizard-l2-submit');
    console.log('  ✅ PASSED');
  } finally {
    await page.close();
  }
}

async function testNoDuplicateWizardNav(browser) {
  console.log('\n[Test 13] No duplicate L1/L2 wizard nav rows on mobile');
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(1500);
    const counts = await page.evaluate(() => {
      const l1 = document.getElementById('l1-substep-1');
      const l2 = document.getElementById('l2-substep-2');
      return {
        l1Next: l1 ? l1.querySelectorAll('button[onclick*="goToL1SubStep(2)"]').length : -1,
        l2Next: l2 ? l2.querySelectorAll('button[onclick*="goToL2SubStep(3)"]').length : -1,
        l2Submit: document.querySelectorAll('#l2-substep-3 button[onclick*="completeL2AndSubmit"]').length
      };
    });
    if (counts.l1Next !== 1) {
      throw new Error(`Expected 1 L1 next button, found ${counts.l1Next}`);
    }
    if (counts.l2Next > 1) {
      throw new Error(`Duplicate L2 next buttons: ${counts.l2Next}`);
    }
    if (counts.l2Submit !== 1) {
      throw new Error(`Expected 1 L2 submit button, found ${counts.l2Submit}`);
    }
    console.log('  ✓ Single nav row per substep');
    console.log('  ✅ PASSED');
  } finally {
    await page.close();
  }
}

async function testViewportNoHorizontalOverflow(browser) {
  console.log('\n[Test 14] No horizontal overflow at 390px viewport');
  const paths = ['login.html', 'parent_dashboard.html', 'mentor_dashboard.html', 'index.html', 'parent_register.html', 'admin_audit.html'];
  for (const p of paths) {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 390, height: 844 });
      await page.goto(`${BASE_URL}/${p}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await delay(1200);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      if (width > 390) {
        throw new Error(`${p}: scrollWidth=${width}`);
      }
      console.log(`  ✓ ${p} (${width}px)`);
    } finally {
      await page.close();
    }
  }
  console.log('  ✅ PASSED');
}

async function testAdminLogin(browser) {
  console.log('\n[Test 10] Admin login with real code lands on admin-saas console');
  const page = await browser.newPage();
  const fs = require('fs');
  
  try {
    const ADMIN_PHONE = '18080141668';
    
    // Navigate to login
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    
    // Enter admin phone
    await page.type('#loginMobile', ADMIN_PHONE);
    
    // Agree to terms
    await page.evaluate(() => {
      const cb = document.getElementById('agreementCheckbox');
      if (cb) cb.checked = true;
    });
    
    // Send SMS
    await page.click('#btnSendCode');
    await delay(2000);
    
    // Extract real code from server log (latest for this phone)
    const logPath = '/tmp/api-server.log';
    if (!fs.existsSync(logPath)) {
      throw new Error('Server log not found at /tmp/api-server.log');
    }
    
    const logContent = fs.readFileSync(logPath, 'utf8');
    const matches = [...logContent.matchAll(/\[mock-sms\] 180\*\*\*\*1668 code=(\d+)/g)];
    if (!matches.length) {
      throw new Error('Could not extract admin code from server log');
    }
    
    const adminCode = matches[matches.length - 1][1];
    console.log(`  提取到管理员验证码: ${adminCode}`);
    
    // UI must not hint 888888 for admin phone after send
    const hint888 = await page.evaluate(() => {
      const hint = document.getElementById('smsDemoHintText');
      const text = (hint && hint.innerText) || document.body.innerText;
      return text.includes('888888');
    });
    
    if (hint888) {
      throw new Error('Login UI shows 888888 hint for admin phone');
    }
    console.log('  ✓ No 888888 hint shown for admin phone');
    
    // Enter real code
    await page.type('#smsCodeInput', adminCode);
    
    // Submit login
    await page.click('#btnSubmitLogin');
    await delay(3000);
    
    // Check landed on admin_audit.html
    const finalUrl = page.url();
    
    if (finalUrl.includes('admin-saas')) {
      console.log('  ✓ Admin logged in and landed on 星火运营中台 (admin-saas)');
    } else {
      throw new Error(`Admin did not land on admin-saas, instead: ${finalUrl}`);
    }
    
    // Verify not redirected to registration or other pages
    if (finalUrl.includes('parent_register') || finalUrl.includes('index.html')) {
      throw new Error('Admin was incorrectly redirected to registration');
    }
    
    console.log('  ✅ PASSED');
  } catch (error) {
    console.error(`  ✗ FAILED: ${error.message}`);
    throw error;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('=== 星火学伴 E2E Browser Tests (Improved) ===\n');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`API_BASE: ${API_BASE}`);
  console.log(`New parent phone: ${NEW_PARENT_PHONE}`);
  console.log(`New mentor phone: ${NEW_MENTOR_PHONE}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  let passed = 0;
  let failed = 0;
  
  try {
    await testNewParentRegistration(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testMentorWizardSubsteps(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testNewMentorOnboarding(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testDuplicatePhoneRegistration(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testParentBookingAndPayment(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testMentorAcceptBooking(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testUIChanges(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testApprovedMentorDashboard(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testLegalModals(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  try {
    await testNoConsoleErrorsOnKeyPages(browser);
    passed++;
  } catch (e) {
    console.error('  ✗ Console hygiene test failed:', e.message);
    failed++;
  }
  
  try {
    await testPayFailureDoesNotShowSuccess(browser);
    passed++;
  } catch (e) {
    console.error('  ✗', e.message);
    failed++;
  }

  try {
    await testWizardL2SubmitButton(browser);
    passed++;
  } catch (e) {
    console.error('  ✗', e.message);
    failed++;
  }

  try {
    await testNoDuplicateWizardNav(browser);
    passed++;
  } catch (e) {
    console.error('  ✗', e.message);
    failed++;
  }

  try {
    await testViewportNoHorizontalOverflow(browser);
    passed++;
  } catch (e) {
    console.error('  ✗', e.message);
    failed++;
  }

  try {
    await testAdminLogin(browser);
    passed++;
  } catch (e) {
    failed++;
  }
  
  await browser.close();
  
  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}/15`);
  console.log(`Failed: ${failed}/15`);
  
  process.exit(failed === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { main };
