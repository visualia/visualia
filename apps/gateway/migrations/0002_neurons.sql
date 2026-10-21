-- Workers AI reports its billing unit (neurons) in usage; cost_usd is derived
-- from it when present (src/prices.js).
ALTER TABLE usage ADD COLUMN neurons REAL;
