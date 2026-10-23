-- Boards (plans/boards.md): many per school, each a surface that one Board
-- Durable Object holds (its name is the board id). The things on a board live
-- in that object, not here; this table lists the boards.
CREATE TABLE boards (
  id         TEXT PRIMARY KEY,
  school_id  TEXT NOT NULL REFERENCES schools(id),
  title      TEXT NOT NULL,
  person_id  TEXT NOT NULL REFERENCES people(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT
);
CREATE INDEX boards_school ON boards (school_id, updated_at);
