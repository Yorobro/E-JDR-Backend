-- Migration V006 — Ajout des champs détaillés d'une fiche de personnage.
--
-- La fiche ne stockait que son `name`. On ajoute ici tous les champs de la fiche papier
-- (hors compétences), regroupés en sections :
--   * Identité (texte court)      : formation, niveau, peuple, sexe, taille/poids, âge, apparence.
--   * Caractéristiques (entiers)  : dextérité, intelligence, perception, social, vigueur.
--   * Ressources de combat (ent.) : points de vie, points de magie, protection, monnaie.
--   * Zones de texte long         : armes, armures, équipement, sorts & miracles, notes.
--
-- Tous les champs sont NULLables (saisie souple : seul le nom reste obligatoire). Aucune
-- règle métier n'est portée par le schéma.
--
-- ⚠️ Numéro V006 à coordonner avec l'équipe avant merge (cf. db/MIGRATION.md).

ALTER TABLE character_sheets
    -- Identité (texte court)
    ADD COLUMN formation        VARCHAR(255) NULL,
    ADD COLUMN niveau           VARCHAR(255) NULL,
    ADD COLUMN peuple           VARCHAR(255) NULL,
    ADD COLUMN sexe             VARCHAR(255) NULL,
    ADD COLUMN taille_et_poids  VARCHAR(255) NULL,
    ADD COLUMN age              VARCHAR(255) NULL,
    ADD COLUMN apparence        VARCHAR(255) NULL,
    -- Caractéristiques (entiers)
    ADD COLUMN dexterite        INT NULL,
    ADD COLUMN intelligence     INT NULL,
    ADD COLUMN perception       INT NULL,
    ADD COLUMN social           INT NULL,
    ADD COLUMN vigueur          INT NULL,
    -- Ressources de combat (entiers)
    ADD COLUMN points_de_vie    INT NULL,
    ADD COLUMN points_de_magie  INT NULL,
    ADD COLUMN protection       INT NULL,
    ADD COLUMN monnaie          INT NULL,
    -- Zones de texte long
    ADD COLUMN armes            TEXT NULL,
    ADD COLUMN armures          TEXT NULL,
    ADD COLUMN equipement       TEXT NULL,
    ADD COLUMN sorts_et_miracles TEXT NULL,
    ADD COLUMN notes            TEXT NULL;
