-- Who served a call, when it ran on a class member's computer (the pool,
-- apps/pool): that worker's person id. Null for the cloud and for m1-1.
-- person_id stays the one who asked; the two are never sent to each other.
ALTER TABLE usage ADD COLUMN served_by TEXT;
