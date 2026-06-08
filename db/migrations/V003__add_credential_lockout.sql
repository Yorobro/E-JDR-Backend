-- Ajoute la gestion du verrouillage de compte après trop de tentatives échouées.
ALTER TABLE credentials
  ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN locked_until    DATETIME    NULL;
