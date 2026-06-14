-- Migration V006 — Ajout des champs détaillés d'une fiche de personnage.
--
-- Sections :
--   * Identité   : formation, niveau (int), peuple, sexe (M/F/NB), taille/poids, age (int), apparence.
--   * Caractéristiques (int) : dextérité, intelligence, perception, social, vigueur.
--   * Combat (int)           : points de vie, points de magie, protection.
--   * Bourse (int)           : purse_gold, purse_silver, purse_copper (value object Purse).
--   * Textes longs           : armures, armes, competences, equipement, sorts & miracles, notes.
--
-- Tous les champs sont NULLables (saisie souple ; seul le nom est requis). Aucune règle métier
-- portée par le schéma : la validation (sexe M/F/NB, bourse ≥ 0, etc.) vit dans le domaine.
--
-- ⚠️ Numéro V006 à coordonner avec l'équipe avant merge (cf. db/MIGRATION.md).

ALTER TABLE character_sheets
    -- Identité
    ADD COLUMN formation        VARCHAR(255) NULL,
    ADD COLUMN niveau           INT NULL,
    ADD COLUMN peuple           VARCHAR(255) NULL,
    ADD COLUMN sexe             VARCHAR(10) NULL,
    ADD COLUMN taille_et_poids  VARCHAR(255) NULL,
    ADD COLUMN age              INT NULL,
    ADD COLUMN apparence        TEXT NULL,
    -- Caractéristiques
    ADD COLUMN dexterite        INT NULL,
    ADD COLUMN intelligence     INT NULL,
    ADD COLUMN perception       INT NULL,
    ADD COLUMN social           INT NULL,
    ADD COLUMN vigueur          INT NULL,
    -- Combat
    ADD COLUMN points_de_vie    INT NULL,
    ADD COLUMN points_de_magie  INT NULL,
    ADD COLUMN protection       INT NULL,
    -- Bourse (value object Purse)
    ADD COLUMN purse_gold       INT NULL,
    ADD COLUMN purse_silver     INT NULL,
    ADD COLUMN purse_copper     INT NULL,
    -- Textes longs
    ADD COLUMN armures          TEXT NULL,
    ADD COLUMN armes            TEXT NULL,
    ADD COLUMN competences      TEXT NULL,
    ADD COLUMN equipement       TEXT NULL,
    ADD COLUMN sorts_et_miracles TEXT NULL,
    ADD COLUMN notes            TEXT NULL;
