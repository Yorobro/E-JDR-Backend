-- Migration V001 — Création des tables d'authentification et d'identité.
--
-- Séparation des responsabilités au niveau des données :
--   * `users`        : identité **métier** (sera enrichie par les champs JDR à venir).
--   * `credentials`  : données d'**authentification** (e-mail + empreinte du mot de passe),
--                      reliées 1–1 à un utilisateur.
--   * `refresh_tokens` : sessions révocables, rattachées à l'utilisateur.

-- Crée le schéma `e_jdr` si nécessaire (même jeu de caractères que la base)
CREATE SCHEMA IF NOT EXISTS e_jdr
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id         CHAR(36) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credentials (
    id            CHAR(36)     NOT NULL,
    user_id       CHAR(36)     NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_credentials_user_id (user_id),
    UNIQUE KEY uq_credentials_email (email),
    CONSTRAINT fk_credentials_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         CHAR(36)     NOT NULL,
    user_id    CHAR(36)     NOT NULL,
    token_hash CHAR(64)     NOT NULL,
    expires_at DATETIME     NOT NULL,
    created_at DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_tokens_token_hash (token_hash),
    KEY idx_refresh_tokens_user_id (user_id),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
