-- Every project is a folder of files now (plans/multi-file.md): projects.kind
-- (0011) is gone. Versions from before are one page, projects/<id>/<n>.html;
-- the studio turns each into a manifest the first time it is read.
ALTER TABLE projects DROP COLUMN kind;
