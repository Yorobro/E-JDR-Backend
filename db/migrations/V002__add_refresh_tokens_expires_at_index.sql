-- Migration V002 — Index sur refresh_tokens.expires_at.
-- Objectif : rendre efficace la purge périodique des jetons expirés
-- (DELETE FROM refresh_tokens WHERE expires_at < ?).

CREATE INDEX idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at);
