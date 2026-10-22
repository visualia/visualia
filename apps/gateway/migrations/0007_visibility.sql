-- Who sees a project: 'private' (the owner only) or 'class' (every member of
-- the school). New projects are private; projects made before this were all
-- open to the class, so they stay that way.
ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
UPDATE projects SET visibility = 'class';
