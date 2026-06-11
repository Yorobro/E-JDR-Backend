-- Migration V002 — Index sur refresh_tokens.expires_at.
-- Objectif : rendre efficace la purge périodique des jetons expirés
-- (DELETE FROM refresh_tokens WHERE expires_at < ?).
-- Idempotent : ne recrée pas l'index s'il existe déjà (échec partiel, base pré-existante).

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'refresh_tokens'
    AND index_name = 'idx_refresh_tokens_expires_at'
);
SET @sql := IF(@index_exists = 0,
  'CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
