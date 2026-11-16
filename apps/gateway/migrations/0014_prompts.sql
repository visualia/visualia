-- A school's own version of a prompt the platform adds to model calls
-- (plans/prompts.md). No row: the course default from the code. Only a
-- teacher writes here (studio /api/prompts).
CREATE TABLE prompts (
  school_id  TEXT NOT NULL REFERENCES schools(id),
  id         TEXT NOT NULL,      -- apps/studio/src/prompts.js
  text       TEXT NOT NULL,
  person_id  TEXT NOT NULL REFERENCES people(id), -- who changed it last
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (school_id, id)
);
