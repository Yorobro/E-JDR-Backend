-- Migration V005 — Création des fiches de personnage et de leur liaison aux campagnes.
--
-- Modèle :
--   * `character_sheets`     : la fiche, indépendante, appartient à un utilisateur (owner_id).
--   * `campaign_characters`  : liaison N-N entre campagnes et fiches (une fiche peut être
--                              rattachée à plusieurs campagnes). La PK composite empêche
--                              les doublons de rattachement.
--
-- ⚠️ Numéro V005 à coordonner avec l'équipe avant merge (cf. db/MIGRATION.md).

CREATE TABLE IF NOT EXISTS character_sheets (
    id         CHAR(36)     NOT NULL,
    owner_id   CHAR(36)     NOT NULL,
    name       VARCHAR(120) NOT NULL,
    created_at DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_character_sheets_owner_id (owner_id),
    CONSTRAINT fk_character_sheets_owner
        FOREIGN KEY (owner_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_characters (
    campaign_id        CHAR(36) NOT NULL,
    character_sheet_id CHAR(36) NOT NULL,
    created_at         DATETIME NOT NULL,
    PRIMARY KEY (campaign_id, character_sheet_id),
    KEY idx_campaign_characters_sheet (character_sheet_id),
    CONSTRAINT fk_campaign_characters_campaign
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_campaign_characters_sheet
        FOREIGN KEY (character_sheet_id) REFERENCES character_sheets (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
