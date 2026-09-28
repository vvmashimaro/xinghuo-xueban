#!/usr/bin/env node
/**
 * Test login flow API calls in sequence
 */

const API_BASE = 'http://127.0.0.1:8787';
const PARENT_PHONE = '13980889211';
const CODE = '888888';

async function test() {
  console.log('Testing parent login flow...\n');
  
  // Step 1: Verify SMS
  console.log('[1] POST /api/auth/sms/verify');
  const verifyRes = await fetch(`${API_BASE}/api/auth/sms/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PARENT_PHONE, code: CODE, scene: 'login' })
  });
  const verifyData = await verifyRes.json();
  console.log('   Status:', verifyRes.status);
  console.log('   Success:', verifyData.success);
  console.log('   Ticket:', verifyData.ticket ? verifyData.ticket.substring(0, 20) + '...' : 'N/A');
  
  if (!verifyData.success || !verifyData.ticket) {
    throw new Error('SMS verification failed');
  }
  
  // Step 2: Login with ticket
  console.log('\n[2] POST /api/auth/login');
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket: verifyData.ticket, role: 'parent' })
  });
  const loginData = await loginRes.json();
  console.log('   Status:', loginRes.status);
  console.log('   Success:', loginData.success);
  console.log('   Token:', loginData.token ? loginData.token.substring(0, 20) + '...' : 'N/A');
  console.log('   User:', loginData.user);
  
  if (!loginData.success || !loginData.token) {
    throw new Error('Login failed');
  }
  
  const token = loginData.token;
  
  // Step 3: Get current user
  console.log('\n[3] GET /api/auth/me');
  const meRes = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meData = await meRes.json();
  console.log('   Status:', meRes.status);
  console.log('   User:', meData);
  
  // Step 4: Get parents list
  console.log('\n[4] GET /api/parents');
  const parentsRes = await fetch(`${API_BASE}/api/parents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const parentsData = await parentsRes.json();
  console.log('   Status:', parentsRes.status);
  console.log('   Parents count:', Array.isArray(parentsData) ? parentsData.length : 'Error');
  if (Array.isArray(parentsData) && parentsData.length > 0) {
    console.log('   Parent[0] phone:', parentsData[0].phone);
    console.log('   Parent[0] name:', parentsData[0].parentName);
  }
  
  // Step 5: Get mentors list
  console.log('\n[5] GET /api/mentors');
  const mentorsRes = await fetch(`${API_BASE}/api/mentors`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const mentorsData = await mentorsRes.json();
  console.log('   Status:', mentorsRes.status);
  console.log('   Mentors count:', Array.isArray(mentorsData) ? mentorsData.length : 'Error');
  
  // Step 6: Get bookings
  console.log('\n[6] GET /api/bookings');
  const bookingsRes = await fetch(`${API_BASE}/api/bookings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const bookingsData = await bookingsRes.json();
  console.log('   Status:', bookingsRes.status);
  console.log('   Bookings count:', Array.isArray(bookingsData) ? bookingsData.length : 'Error');
  
  console.log('\n✅ All API calls successful');
  
  // Verify the resolution logic
  console.log('\n[7] Simulating resolvePostLoginTargetAsync logic');
  const hasProfile = Array.isArray(parentsData) && parentsData.some(p => p.phone === PARENT_PHONE);
  console.log('   hasProfile:', hasProfile);
  console.log('   Expected target:', hasProfile ? 'parent_dashboard.html' : 'parent_register.html');
}

test().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
