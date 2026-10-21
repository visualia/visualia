-- Streaming calls: time to first token, and whether the call streamed.
ALTER TABLE usage ADD COLUMN first_token_ms INTEGER;
ALTER TABLE usage ADD COLUMN streamed INTEGER NOT NULL DEFAULT 0;
