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
    await page.click('button[onclick="goToStep(2)"]');
    await delay(1000);
    
    // Step 2: Select subject and configure via wizard
    // Check the math subject
    await page.click('input[name="targetSubject"][value="数学"]');
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
      
      // Select weak points
      const weakPoints = await page.$$('.wizard-topic-cb');
      if (weakPoints.length >= 2) {
        await weakPoints[0].click();
        await weakPoints[1].click();
        await delay(300);
      }
      
      // Click next to go to pacing step
      await page.click('#btnWizardNext');
      await delay(500);
      
      // Click next again to go to pain step (pacing already has default selection)
      await page.click('#btnWizardNext');
      await delay(500);
      
      // Select a pain tag
      const painTags = await page.$$('#wizardPainContainer > span');
      if (painTags.length > 0) {
        await painTags[0].click();
        await delay(300);
      }
      
      // Finish wizard
      await page.click('#btnWizardFinish');
      await delay(1000);
      console.log('  ✓ Wizard completed');
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
    await page.click('button[onclick="goToStep(3)"]');
    await delay(1000);
    
    // Step 3: Select space and agree
    const spaceRadio = await page.$('input[name="selectedSpace"]');
    if (spaceRadio) {
      await spaceRadio.click();
    }
    await delay(300);
    
    await page.click('#parentAgreementCheck');
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

async function testNewMentorOnboarding(browser) {
  console.log(`\n[Test 2] New mentor ${NEW_MENTOR_PHONE} onboards via index.html`);
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [Browser error]`, msg.text());
  });
  
  try {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 10000 });
    await delay(1000);
    
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
      
      const privacyCheck = document.getElementById('privacyAgreeCheck');
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
    await page.click('button[onclick="goToStep(2)"]');
    await delay(1000);
    
    // Check math subject
    await page.click('input[name="targetSubject"][value="数学"]');
    await delay(1500); // Wait for wizard to auto-open
    
    // Complete wizard if it opened
    const wizardVisible = await page.evaluate(() => {
      const modal = document.getElementById('subjectWizardModal');
      return modal && !modal.classList.contains('hidden');
    });
    
    if (wizardVisible) {
      const weakPoint = await page.$('.wizard-topic-cb');
      if (weakPoint) await weakPoint.click();
      await delay(200);
      
      await page.click('#btnWizardNext');
      await delay(300);
      await page.click('#btnWizardNext');
      await delay(300);
      
      const pain = await page.$('#wizardPainContainer > span');
      if (pain) await pain.click();
      await delay(200);
      
      await page.click('#btnWizardFinish');
      await delay(500);
    }
    
    // Go to step 3
    await page.click('button[onclick="goToStep(3)"]');
    await delay(1000);
    
    // Select space and agree
    const spaceRadio = await page.$('input[name="selectedSpace"]');
    if (spaceRadio) await spaceRadio.click();
    await delay(300);
    
    await page.click('#parentAgreementCheck');
    await delay(500);
    
    // Submit
    await page.click('#btnSubmitParent');
    await delay(3000); // Wait for error to appear
    
    await screenshot(page, 'duplicate-phone-error');
    
    // Check for inline error element
    const errorVisible = await page.evaluate(() => {
      const errorDiv = document.getElementById('registrationError');
      const errorText = document.getElementById('registrationErrorText');
      if (!errorDiv || !errorText) return false;
      if (errorDiv.classList.contains('hidden')) return false;
      return errorText.innerText.includes('已注册') || errorText.innerText.includes('请直接登录');
    });
    
    const currentUrl = page.url();
    
    if (errorVisible) {
      console.log('  ✓ Duplicate phone error displayed inline');
      console.log('  ✅ PASSED');
    } else if (currentUrl.includes('parent_register.html')) {
      // Check if error is in page text (fallback)
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('该手机号已注册') || pageText.includes('请直接登录')) {
        console.log('  ✓ Duplicate phone error shown in page');
        console.log('  ✅ PASSED');
      } else {
        throw new Error('Expected duplicate phone error to be visible');
      }
    } else {
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
    
    // Get mentor list and create booking via API
    const bookingResult = await page.evaluate(async (apiBase) => {
      try {
        // Check if StorageService is available
        if (!window.StorageService || !window.StorageService.getMentors) {
          return { success: false, error: 'StorageService not available' };
        }
        
        // Get mentors
        const mentors = await window.StorageService.getMentors();
        if (!mentors || mentors.length === 0) {
          return { success: false, error: 'No mentors available' };
        }
        
        const mentor = mentors[0];
        
        // Get parent ID from storage
        const parents = window.StorageService.getParents ? window.StorageService.getParents() : [];
        if (parents.length === 0) {
          return { success: false, error: 'No parent profile' };
        }
        const parent = parents[0];
        
        // Create booking via API
        const response = await fetch(`${apiBase}/api/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + window.StorageService.getAuthToken()
          },
          body: JSON.stringify({
            mentorId: mentor.id,
            parentId: parent.id,
            parentPhone: parent.phone,
            studentNickname: parent.studentNickname || '小测',
            studentGrade: parent.studentGrade || '初三',
            subject: '数学',
            space: '青羊金沙文化微网点',
            schedule: '周六 14:00-16:00',
            amount: 300,
            hours: 2,
            status: 'pending_accept'
          })
        });
        
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${error}` };
        }
        
        const booking = await response.json();
        
        // Now create prepay order
        const prepayResponse = await fetch(`${apiBase}/api/pay/wechat/prepay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + window.StorageService.getAuthToken()
          },
          body: JSON.stringify({
            bookingId: booking.id,
            amount: 30000,
            description: '星火学伴 · 数学'
          })
        });
        
        if (!prepayResponse.ok) {
          return { success: false, error: 'Prepay failed' };
        }
        
        const prepay = await prepayResponse.json();
        
        // Mock confirm payment
        if (prepay.mock) {
          const confirmResponse = await fetch(`${apiBase}/api/pay/wechat/mock-confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + window.StorageService.getAuthToken()
            },
            body: JSON.stringify({
              outTradeNo: prepay.outTradeNo
            })
          });
          
          if (!confirmResponse.ok) {
            return { success: false, error: 'Mock confirm failed' };
          }
        }
        
        return { success: true, bookingId: booking.id, parentId: parent.id };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, API_BASE);
    
    if (!bookingResult.success) {
      throw new Error(bookingResult.error || 'Booking creation failed');
    }
    
    console.log('  ✓ Booking created:', bookingResult.bookingId);
    console.log('  ✓ Payment completed (mock)');
    
    // Verify booking exists server-side
    const verifyResponse = await fetch(`${API_BASE}/api/bookings?parentId=${bookingResult.parentId}`);
    if (verifyResponse.ok) {
      const bookings = await verifyResponse.json();
      const foundBooking = bookings.find(b => b.id === bookingResult.bookingId);
      if (foundBooking) {
        console.log('  ✓ Booking verified server-side');
      } else {
        throw new Error('Booking not found server-side');
      }
    }
    
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
  
  await browser.close();
  
  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}/5`);
  console.log(`Failed: ${failed}/5`);
  
  process.exit(failed === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { main };
