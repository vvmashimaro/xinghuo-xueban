/**
 * 星火学伴 · 统一库 API
 * 监听 0.0.0.0:8787，供网页与微信小程序共享读写
 */
'use strict';

const express = require('express');
const cors = require('cors');
const db = require('./db');

const PORT = 8787;
const HOST = '0.0.0.0';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '8mb' }));

function ok(res, data) {
  res.json(data);
}

function fail(res, status, message) {
  res.status(status).json({ error: message || 'error' });
}

app.get('/api/health', (req, res) => {
  ok(res, {
    ok: true,
    service: 'xinghuo-platform',
    port: PORT,
    time: new Date().toISOString(),
    db: db.DB_PATH
  });
});

app.get('/api/snapshot', (req, res) => {
  db.seedIfEmpty();
  ok(res, db.snapshot());
});

app.post('/api/snapshot', (req, res) => {
  const body = req.body || {};
  ok(res, db.replaceSnapshot(body));
});

app.post('/api/reset', (req, res) => {
  ok(res, db.reset());
});

/* Mentors */
app.get('/api/mentors', (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getMentors());
});

app.post('/api/mentors', (req, res) => {
  const mentor = db.addMentor(req.body || {});
  ok(res, mentor);
});

app.get('/api/mentors/phone/:phone', (req, res) => {
  const m = db.getMentorByPhone(req.params.phone);
  if (!m) return fail(res, 404, 'mentor not found');
  ok(res, m);
});

app.get('/api/mentors/:id', (req, res) => {
  const m = db.getMentorById(req.params.id);
  if (!m) return fail(res, 404, 'mentor not found');
  ok(res, m);
});

app.patch('/api/mentors/:id', (req, res) => {
  const body = req.body || {};
  const options = body._options || {};
  const patch = Object.assign({}, body);
  delete patch._options;
  const updated = db.updateMentor(req.params.id, patch, options);
  if (!updated) return fail(res, 404, 'mentor not found');
  ok(res, updated);
});

/* Parents */
app.get('/api/parents', (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getParents());
});

app.post('/api/parents', (req, res) => {
  const parent = db.saveParent(req.body || {});
  ok(res, parent);
});

app.get('/api/parents/phone/:phone', (req, res) => {
  const p = db.getParentByPhone(req.params.phone);
  if (!p) return fail(res, 404, 'parent not found');
  ok(res, p);
});

/* Bookings */
app.get('/api/bookings', (req, res) => {
  db.seedIfEmpty();
  ok(res, db.getBookings());
});

app.post('/api/bookings', (req, res) => {
  const booking = db.addBooking(req.body || {});
  ok(res, booking);
});

app.patch('/api/bookings/:id', (req, res) => {
  const updated = db.updateBooking(req.params.id, req.body || {});
  if (!updated) return fail(res, 404, 'booking not found');
  ok(res, updated);
});

app.post('/api/bookings/:id/respond', (req, res) => {
  const updated = db.respondToBooking(req.params.id, req.body || {});
  if (!updated) return fail(res, 404, 'booking not found');
  ok(res, updated);
});


app.post('/api/bookings/:id/leave', (req, res) => {
  const body = req.body || {};
  const sessionId = body.sessionId;
  const action = body.action || 'request';
  let result;
  if (action === 'confirm' || action === 'approve') {
    result = db.confirmSessionLeave(req.params.id, sessionId, true);
  } else if (action === 'reject') {
    result = db.confirmSessionLeave(req.params.id, sessionId, false);
  } else {
    result = db.requestSessionLeave(req.params.id, sessionId, body.byRole || 'parent');
  }
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'leave failed' });
  }
  ok(res, result);
});

app.post('/api/bookings/:id/complete', (req, res) => {
  const body = req.body || {};
  const result = db.completeSession(req.params.id, body.sessionId, {
    completedBy: body.completedBy || 'mentor',
    classSummary: body.classSummary || null,
    mentorId: body.mentorId
  });
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'complete failed' });
  }
  ok(res, result);
});

app.post('/api/bookings/:id/summary', (req, res) => {
  const body = req.body || {};
  const result = db.saveClassSummary(req.params.id, body.sessionId, body.classSummary || body, body.mentorId);
  if (!result || result.ok === false) {
    return res.status(400).json(result || { ok: false, error: 'summary failed' });
  }
  ok(res, result);
});

app.post('/api/mentors/:id/availability', (req, res) => {
  const updated = db.setMentorAvailability(req.params.id, (req.body && req.body.availability) || req.body || []);
  if (!updated) return fail(res, 404, 'mentor not found');
  ok(res, updated);
});

app.post('/api/bookings/process-escrow', (req, res) => {
  ok(res, db.processEscrowReleases());
});

/* Contracts */
app.get('/api/contracts', (req, res) => {
  ok(res, db.getContracts());
});

app.post('/api/contracts', (req, res) => {
  ok(res, db.saveContract(req.body || {}));
});

/* Session */
app.get('/api/session', (req, res) => {
  ok(res, db.getSession());
});

app.put('/api/session', (req, res) => {
  ok(res, db.setSession(req.body || {}));
});

/* Tutor match */
app.post('/api/tutors/match', (req, res) => {
  const tutors = db.matchTutors(req.body || {});
  ok(res, tutors);
});

app.use((req, res) => {
  fail(res, 404, 'not found: ' + req.method + ' ' + req.path);
});

app.listen(PORT, HOST, () => {
  console.log(`[xinghuo-platform] listening http://${HOST}:${PORT}`);
  console.log(`[xinghuo-platform] db → ${db.DB_PATH}`);
  console.log('[xinghuo-platform] CORS * enabled');
});
