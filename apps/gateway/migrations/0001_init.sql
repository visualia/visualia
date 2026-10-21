-- Schools, people and their course keys, and the usage record of every model call.
-- Keys are stored only as SHA-256 hashes.

CREATE TABLE schools (
  id    TEXT PRIMARY KEY,          -- slug, e.g. 'eka'
  name  TEXT NOT NULL
);

CREATE TABLE people (
  id        TEXT PRIMARY KEY,      -- pseudonymous id, e.g. 'eka-001'
  school_id TEXT NOT NULL REFERENCES schools(id),
  role      TEXT NOT NULL DEFAULT 'student'   -- student | teacher
);

CREATE TABLE keys (
  hash       TEXT PRIMARY KEY,     -- sha256 hex of the course key
  person_id  TEXT NOT NULL REFERENCES people(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at TEXT
);

CREATE TABLE usage (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  ts                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),  -- UTC
  school_id          TEXT NOT NULL,
  person_id          TEXT NOT NULL,
  model              TEXT NOT NULL,
  tokens_in          INTEGER,      -- fresh input
  tokens_cache_read  INTEGER,
  tokens_cache_write INTEGER,
  tokens_out         INTEGER,
  tokens_reasoning   INTEGER,
  latency_ms         INTEGER,
  cost_usd           REAL,         -- null until the model has a price in src/prices.js
  ok                 INTEGER NOT NULL,
  error              TEXT
);

CREATE INDEX usage_person_ts ON usage(person_id, ts);
