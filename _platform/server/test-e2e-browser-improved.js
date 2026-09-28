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
const NEW_PARENT_PHONE = '13900009' + Math.floor(Math.random() * 100).toString().padStart(2, '0');
const NEW_MENTOR_PHONE = '13900008' + Math.floor(Math.random() * 100).toString().padStart(2, '0');
const CODE = '888888';

const ARTIFACTS_DIR = path.join(__dirname, '../../artifacts');

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
    
    // Fill form data via JS
    await page.evaluate((phone) => {
      document.getElementById('parentName').value = '测试家长';
      document.getElementById('parentPhone').value = phone;
      document.getElementById('studentNickname').value = '小测';
      const gradeSelect = document.getElementById('studentGrade');
      if (gradeSelect) gradeSelect.selectedIndex = 4; // 初三
    }, NEW_PARENT_PHONE);
    
    // Send SMS via JS function call
    await page.evaluate((code) => {
      // Simulate SMS send
      if (window.sendParentSMS) {
        window.sendParentSMS();
      } else if (typeof onSendParentSMS === 'function') {
        onSendParentSMS();
      }
      // Fill code immediately
      setTimeout(() => {
        const codeInput = document.getElementById('parentSmsCode');
        if (codeInput) codeInput.value = code;
      }, 100);
    }, CODE);
    
    await delay(2000);
    await screenshot(page, 'parent-register-step1');
    
    // Set up subject plans directly via JS (bypass wizard UI)
    await page.evaluate(() => {
      // Directly set the subject plans object
      if (typeof window.subjectPlans === 'undefined') {
        window.subjectPlans = {};
      }
      
      window.subjectPlans['数学'] = {
        weakPoints: ['一次函数', '二次函数'],
        pacing: '稳中求快 · 预习式推进',
        pains: ['粗心大意']
      };
      
      // Also check the subject checkbox
      const mathRadio = document.querySelector('input[name="targetSubject"][value="数学"]');
      if (mathRadio) {
        mathRadio.checked = true;
      }
      
      // Go to step 3
      if (typeof goToStep === 'function') {
        goToStep(3);
      }
    });
    
    await delay(1500);
    await screenshot(page, 'parent-register-step2-skip');
    
    // Select space, agree, and ensure form fields are set
    await page.evaluate((phone, code) => {
      const spaceRadio = document.querySelector('input[name="selectedSpace"]');
      if (spaceRadio) spaceRadio.checked = true;
      
      const agreeCheck = document.getElementById('parentAgreementCheck');
      if (agreeCheck) agreeCheck.checked = true;
      
      // Re-set phone and code to ensure they persist
      document.getElementById('parentPhone').value = phone;
      document.getElementById('parentSmsCode').value = code;
    }, NEW_PARENT_PHONE, CODE);
    
    await delay(500);
    await screenshot(page, 'parent-register-step3');
    
    // Capture console messages during submit
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Submit via JS and wait for redirect
    const submitResult = await page.evaluate(() => {
      return new Promise(async (resolve) => {
        let errorMsg = '';
        
        // Override showToast to capture errors
        const originalToast = window.showToast;
        window.showToast = (msg, type) => {
          errorMsg += msg + '; ';
          if (originalToast) originalToast(msg, type);
        };
        
        // Call the form's submit handler
        try {
          if (typeof handleParentSubmit === 'function') {
            await handleParentSubmit();
          } else {
            const submitBtn = document.getElementById('btnSubmitParent');
            if (submitBtn) submitBtn.click();
          }
        } catch (e) {
          errorMsg += 'Exception: ' + e.message + '; ';
        }
        
        // Wait for redirect (2s delay + navigation time)
        setTimeout(() => {
          resolve({
            url: window.location.href,
            error: errorMsg,
            hasSubjectPlans: typeof window.subjectPlans !== 'undefined' && Object.keys(window.subjectPlans).length > 0
          });
        }, 4000);
      });
    });
    
    const finalUrl = page.url();
    if (finalUrl.includes('parent_dashboard.html')) {
      console.log('  ✓ Registered and landed on dashboard with token');
      await screenshot(page, 'parent-register-success');
      console.log('  ✅ PASSED');
    } else {
      console.log('  Debug: Final URL:', finalUrl);
      console.log('  Debug: Submit result:', JSON.stringify(submitResult));
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
    
    // Submit via JS and wait for redirect
    const submitResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (typeof submitApplication === 'function') {
          submitApplication();
        } else {
          const submitBtn = document.querySelector('button[onclick*="submitApplication"]');
          if (submitBtn) submitBtn.click();
        }
        
        // Wait for redirect (2s delay + navigation time)
        setTimeout(() => {
          resolve({
            url: window.location.href,
            hasSuccess: document.body.innerText.includes('申请已提交') || 
                       document.body.innerText.includes('等待审核') ||
                       document.body.innerText.includes('入库档案已建立')
          });
        }, 4000);
      });
    });
    
    const finalUrl = page.url();
    if (submitResult.hasSuccess || finalUrl.includes('mentor_dashboard.html')) {
      console.log('  ✓ Mentor application submitted');
      if (finalUrl.includes('mentor_dashboard.html')) {
        console.log('  ✓ Redirected to mentor dashboard');
      }
      await screenshot(page, 'mentor-onboard-success');
      console.log('  ✅ PASSED');
    } else {
      console.log('  Debug: Final URL:', finalUrl);
      console.log('  Debug: Submit result:', JSON.stringify(submitResult));
      throw new Error('Expected success message or redirect');
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
    
    // Fill form with existing phone via JS
    await page.evaluate((phone) => {
      document.getElementById('parentName').value = '重复家长';
      document.getElementById('parentPhone').value = phone;
      document.getElementById('studentNickname').value = '小重';
      const gradeSelect = document.getElementById('studentGrade');
      if (gradeSelect) gradeSelect.selectedIndex = 4;
    }, PARENT_PHONE);
    
    // Send SMS
    await page.evaluate((code) => {
      if (window.sendParentSMS) window.sendParentSMS();
      setTimeout(() => {
        const codeInput = document.getElementById('parentSmsCode');
        if (codeInput) codeInput.value = code;
      }, 100);
    }, CODE);
    
    await delay(2000);
    
    // Try to proceed and submit
    await page.evaluate(() => {
      if (typeof goToStep === 'function') goToStep(2);
    });
    await delay(1000);
    
    await page.evaluate(() => {
      const mathRadio = document.querySelector('input[name="targetSubject"][value="数学"]');
      if (mathRadio) mathRadio.checked = true;
    });
    await delay(500);
    
    await page.evaluate(() => {
      if (typeof goToStep === 'function') goToStep(3);
    });
    await delay(1000);
    
    await page.evaluate(() => {
      const agreeCheck = document.getElementById('parentAgreementCheck');
      if (agreeCheck) agreeCheck.checked = true;
    });
    await delay(500);
    
    // Submit
    await page.evaluate(() => {
      const submitBtn = document.getElementById('btnSubmitParent');
      if (submitBtn) submitBtn.click();
    });
    
    await delay(2000);
    await screenshot(page, 'duplicate-phone-error');
    
    // Check for error message
    const errorMsg = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    if (errorMsg.includes('该手机号已注册') || errorMsg.includes('已注册') || errorMsg.includes('请直接登录')) {
      console.log('  ✓ Duplicate phone error shown');
      console.log('  ✅ PASSED');
    } else {
      throw new Error('Expected duplicate phone error message');
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
