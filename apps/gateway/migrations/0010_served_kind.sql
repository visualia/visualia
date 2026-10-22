-- Which kind of pool worker served a row: 'tab' (a browser tab) or 'node'
-- (the node worker / later the app). For the audit trail; null for non-pool rows.
ALTER TABLE usage ADD COLUMN served_kind TEXT;
