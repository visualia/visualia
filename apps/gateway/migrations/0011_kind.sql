-- What a project is: 'page' (one HTML file per version, projects/<id>/<n>.html)
-- or 'files' (a folder per version: projects/<id>/v/<n>.json, a manifest of
-- content-addressed blobs/<sha256>). New projects stay 'page' for now; the
-- owner converts one. plans/multi-file.md. Goes away with single-file mode.
ALTER TABLE projects ADD COLUMN kind TEXT NOT NULL DEFAULT 'page';
