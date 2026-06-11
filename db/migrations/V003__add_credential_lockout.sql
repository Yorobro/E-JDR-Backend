-- Ajoute la gestion du verrouillage de compte après trop de tentatives échouées.
-- Idempotent : n'ajoute chaque colonne que si elle n'existe pas déjà.

SET @col_failed := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'credentials' AND column_name = 'failed_attempts'
);
SET @sql := IF(@col_failed = 0,
  'ALTER TABLE credentials ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_locked := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'credentials' AND column_name = 'locked_until'
);
SET @sql := IF(@col_locked = 0,
  'ALTER TABLE credentials ADD COLUMN locked_until DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
