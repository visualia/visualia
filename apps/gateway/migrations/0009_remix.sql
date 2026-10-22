-- Remix: a project that started as a copy of another project's version.
-- from_project is the source project's id, from_version the version copied.
-- Null for projects made from scratch.
ALTER TABLE projects ADD COLUMN from_project TEXT;
ALTER TABLE projects ADD COLUMN from_version INTEGER;
CREATE INDEX projects_from ON projects (from_project);
