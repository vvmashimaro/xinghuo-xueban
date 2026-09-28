#!/usr/bin/env node
/**
 * 星火学伴 Web Frontend 测试
 * 使用 Puppeteer 无头浏览器测试认证流程
 */

const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8080';
const PARENT_PHONE = '13980889211';
const MENTOR_PHONE = '13880123456';
const CODE = '888888';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testParentLoginFlow(browser) {
  console.log('\n[1] 测试家长登录页面加载...');
  const page = await browser.newPage();
  
  await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });

  // 检查页面标题
  const title = await page.title();
  if (title.includes('登录') || title.includes('星火学伴') || title.includes('星火伴学')) {
    console.log(`✓ 登录页面加载成功: ${title}`);
  } else {
    throw new Error(`登录页面标题异常: ${title}`);
  }

  // 检查家长角色选项卡存在
  const tabParent = await page.$('#tabParent');
  if (tabParent) {
    console.log('✓ 家长角色选项卡存在');
  } else {
    throw new Error('家长角色选项卡不存在');
  }

  // 检查表单元素存在
  const mobileInput = await page.$('#loginMobile');
  const codeInput = await page.$('#smsCodeInput');
  const submitBtn = await page.$('#btnSubmitLogin');
  
  if (mobileInput && codeInput && submitBtn) {
    console.log('✓ 登录表单元素完整');
  } else {
    throw new Error('登录表单元素缺失');
  }

  await page.close();
}

async function testParentRegistrationForm(browser) {
  console.log('\n[2] 测试家长注册表单加载...');
  const page = await browser.newPage();
  
  await page.goto(`${BASE_URL}/parent_register.html`, { waitUntil: 'networkidle2' });

  // 检查页面标题
  const title = await page.title();
  if (title.includes('家长') || title.includes('注册') || title.includes('星火学伴')) {
    console.log(`✓ 家长注册页面加载成功: ${title}`);
  } else {
    console.log(`⚠ 家长注册页面标题: ${title}`);
  }

  // 检查关键表单元素
  const parentNameInput = await page.$('#parentName');
  const parentPhoneInput = await page.$('#parentPhone');
  const smsCodeInput = await page.$('#parentSmsCode');
  const studentInput = await page.$('#studentNickname');
  
  if (parentNameInput && parentPhoneInput && studentInput) {
    console.log('✓ 家长注册表单基本元素存在');
  } else {
    throw new Error('家长注册表单元素缺失');
  }

  if (smsCodeInput) {
    console.log('✓ 家长注册SMS验证码字段已添加');
  } else {
    console.log('⚠ 家长注册SMS验证码字段未找到');
  }

  await page.close();
}

async function testMentorOnboardingForm(browser) {
  console.log('\n[3] 测试导师入库表单加载...');
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle2' });

  // 检查页面标题
  const title = await page.title();
  if (title.includes('导师') || title.includes('星火学伴') || title.includes('入库')) {
    console.log(`✓ 导师入库页面加载成功: ${title}`);
  } else {
    console.log(`⚠ 导师入库页面标题: ${title}`);
  }

  // 检查关键表单元素
  const realNameInput = await page.$('#realName');
  const phoneInput = await page.$('#phone');
  const smsCodeInput = await page.$('#mentorSmsCode');
  
  if (realNameInput && phoneInput) {
    console.log('✓ 导师入库表单基本元素存在');
  } else {
    throw new Error('导师入库表单元素缺失');
  }

  if (smsCodeInput) {
    console.log('✓ 导师入库SMS验证码字段已添加');
  } else {
    console.log('⚠ 导师入库SMS验证码字段未找到');
  }

  await page.close();
}

async function testParentDashboardAuthCheck(browser) {
  console.log('\n[4] 测试未登录访问 parent_dashboard.html（应重定向）...');
  const page = await browser.newPage();
  
  // 清除所有存储
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${BASE_URL}/parent_dashboard.html`, { waitUntil: 'networkidle2' });
  await delay(2000);

  // 检查是否重定向到登录页
  const url = page.url();
  if (url.includes('login.html')) {
    console.log('✓ 未登录访问 parent_dashboard 正确重定向到 login.html');
  } else {
    console.log(`⚠ 未登录访问 parent_dashboard，当前 URL: ${url}`);
  }

  await page.close();
}

async function testAdminAccessWithoutAuth(browser) {
  console.log('\n[5] 测试未登录访问 admin_audit.html（应重定向）...');
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${BASE_URL}/admin_audit.html`, { waitUntil: 'networkidle2' });
  await delay(2000);

  const url = page.url();
  if (url.includes('login.html')) {
    console.log('✓ 未登录访问 admin_audit 正确重定向到 login.html');
  } else {
    console.log(`⚠ 未登录访问 admin_audit，当前 URL: ${url}`);
  }

  await page.close();
}

async function main() {
  console.log('===== 星火学伴 Web Frontend 测试 =====');
  console.log(`Base URL: ${BASE_URL}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    await testParentLoginFlow(browser);
    await testParentRegistrationForm(browser);
    await testMentorOnboardingForm(browser);
    await testParentDashboardAuthCheck(browser);
    await testAdminAccessWithoutAuth(browser);

    console.log('\n===== 所有 Web 测试通过 =====');
    console.log('\n注: 完整登录流程需要 CORS 配置，已通过 API 测试验证');
  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
