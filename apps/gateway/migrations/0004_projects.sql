-- Studio projects, their versions, and which project a usage row belongs to.
ALTER TABLE usage ADD COLUMN project_id TEXT;

CREATE TABLE projects (
  id                TEXT PRIMARY KEY,          -- random, also the agent's name
  person_id         TEXT NOT NULL REFERENCES people(id),
  slug              TEXT NOT NULL,             -- for the public URL
  title             TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  versions          INTEGER NOT NULL DEFAULT 0,
  published_version INTEGER,
  UNIQUE (person_id, slug)
);
