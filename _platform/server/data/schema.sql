CREATE TABLE availability (
  mentor_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  PRIMARY KEY(mentor_id, weekday, start_time, end_time)
)
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  mentor_id TEXT,
  parent_id TEXT,
  parent_phone TEXT,
  subject TEXT,
  status TEXT,
  type TEXT,
  amount REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
)
CREATE INDEX idx_bookings_mentor ON bookings(mentor_id)
CREATE INDEX idx_bookings_parent ON bookings(parent_id)
CREATE INDEX idx_sessions_booking ON sessions(booking_id)
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  session_date TEXT,
  status TEXT,
  escrow_status TEXT,
  summary_json TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(booking_id) REFERENCES bookings(id)
)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL, -- parent|mentor|admin
  phone TEXT UNIQUE,
  name TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
)
