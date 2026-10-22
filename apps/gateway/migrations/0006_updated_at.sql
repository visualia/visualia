-- When a project last got a new version: the class's "Everyone's work" is ordered by it.
ALTER TABLE projects ADD COLUMN updated_at TEXT;
UPDATE projects SET updated_at = created_at;
