-- Migration V004 — Création de la table des campagnes de jeu de rôle.
--
-- Une `campaign` est créée et possédée par un utilisateur agissant comme **maître du jeu**
-- (`game_master_id`). Un même utilisateur peut posséder plusieurs campagnes. La suppression
-- de l'utilisateur supprime ses campagnes (ON DELETE CASCADE).
--
-- ⚠️ Numéro V004 à coordonner avec l'équipe avant merge (cf. db/MIGRATION.md).

CREATE TABLE IF NOT EXISTS campaigns (
    id             CHAR(36)     NOT NULL,
    game_master_id CHAR(36)     NOT NULL,
    name           VARCHAR(120) NOT NULL,
    created_at     DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_campaigns_game_master_id (game_master_id),
    CONSTRAINT fk_campaigns_game_master
        FOREIGN KEY (game_master_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
