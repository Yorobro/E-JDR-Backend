-- Migration « une fiche = une campagne » : passage du modèle N‑N (table `campaign_characters`)
-- à un modèle 1‑N strict où la campagne devient un attribut de la fiche.
--
-- ⚠️ Migration de DONNÉES (duplication + suppression). FAIRE UN BACKUP avant application sur dev.
-- Étapes (chacune séparée par un statement-breakpoint pour le migrateur drizzle-kit) :
--   1. Ajout des 2 colonnes (campaign_id nullable, status défaut ACCEPTED pour l'existant).
--   2. Rattachement de chaque fiche à sa campagne « principale » (la plus ancienne liaison).
--   3. Éclatement des fiches multi‑campagnes : 1 copie (nouvel id) par campagne supplémentaire,
--      + duplication de leurs lignes filles (6 tables N‑N fiche↔références).
--   4. Suppression des fiches orphelines (présentes dans character_sheets mais sans liaison).
--   5. Passage de campaign_id en NOT NULL + FK + index.
--   6. Suppression de la table `campaign_characters`.

-- 1. Colonnes (campaign_id nullable le temps de la migration ; status ACCEPTED pour l'existant).
ALTER TABLE `character_sheets` ADD `campaign_id` char(36);--> statement-breakpoint
ALTER TABLE `character_sheets` ADD `campaign_link_status` varchar(20) NOT NULL DEFAULT 'ACCEPTED';--> statement-breakpoint

-- 2. Campagne « principale » de chaque fiche = la liaison la plus ancienne (created_at min, id en
--    départage). Les fiches sans liaison restent campaign_id = NULL (supprimées à l'étape 4).
UPDATE `character_sheets` cs
SET cs.`campaign_id` = (
  SELECT cc.`campaign_id`
  FROM `campaign_characters` cc
  WHERE cc.`character_sheet_id` = cs.`id`
  ORDER BY cc.`created_at` ASC, cc.`campaign_id` ASC
  LIMIT 1
);--> statement-breakpoint

-- 3a. Table de correspondance temporaire : 1 ligne par (fiche, campagne) à dupliquer, c.-à-d.
--     toutes les liaisons SAUF la campagne principale déjà portée par la fiche d'origine.
--     Un nouvel id (UUID) est attribué à chaque copie.
CREATE TEMPORARY TABLE `tmp_sheet_copies` (
  `new_id` char(36) NOT NULL,
  `source_sheet_id` char(36) NOT NULL,
  `campaign_id` char(36) NOT NULL,
  PRIMARY KEY (`new_id`)
);--> statement-breakpoint
INSERT INTO `tmp_sheet_copies` (`new_id`, `source_sheet_id`, `campaign_id`)
SELECT UUID(), cc.`character_sheet_id`, cc.`campaign_id`
FROM `campaign_characters` cc
JOIN `character_sheets` cs ON cs.`id` = cc.`character_sheet_id`
WHERE cc.`campaign_id` <> cs.`campaign_id`;--> statement-breakpoint

-- 3b. Crée les fiches copies : tous les champs de la source, nouvel id, campagne = la liaison
--     supplémentaire, statut ACCEPTED (données existantes déjà actives).
INSERT INTO `character_sheets` (
  `id`, `owner_id`, `group_id`, `name`, `created_at`, `campaign_id`, `campaign_link_status`,
  `formation_id`, `niveau`, `peuple_id`, `sexe`, `taille_et_poids`, `age`, `apparence`,
  `dexterite`, `intelligence`, `perception`, `social`, `vigueur`, `points_de_vie`,
  `points_de_magie`, `protection`, `purse_gold`, `purse_silver`, `purse_copper`, `notes`
)
SELECT
  t.`new_id`, cs.`owner_id`, cs.`group_id`, cs.`name`, cs.`created_at`, t.`campaign_id`, 'ACCEPTED',
  cs.`formation_id`, cs.`niveau`, cs.`peuple_id`, cs.`sexe`, cs.`taille_et_poids`, cs.`age`,
  cs.`apparence`, cs.`dexterite`, cs.`intelligence`, cs.`perception`, cs.`social`, cs.`vigueur`,
  cs.`points_de_vie`, cs.`points_de_magie`, cs.`protection`, cs.`purse_gold`, cs.`purse_silver`,
  cs.`purse_copper`, cs.`notes`
FROM `tmp_sheet_copies` t
JOIN `character_sheets` cs ON cs.`id` = t.`source_sheet_id`;--> statement-breakpoint

-- 3c. Duplique les lignes filles N‑N (armes/armures/compétences/équipements/sorts/miracles) de
--     chaque fiche source vers ses copies.
INSERT INTO `sheet_armes` (`sheet_id`, `arme_id`, `created_at`)
SELECT t.`new_id`, s.`arme_id`, s.`created_at`
FROM `tmp_sheet_copies` t JOIN `sheet_armes` s ON s.`sheet_id` = t.`source_sheet_id`;--> statement-breakpoint
INSERT INTO `sheet_armures` (`sheet_id`, `armure_id`, `created_at`)
SELECT t.`new_id`, s.`armure_id`, s.`created_at`
FROM `tmp_sheet_copies` t JOIN `sheet_armures` s ON s.`sheet_id` = t.`source_sheet_id`;--> statement-breakpoint
INSERT INTO `sheet_competences` (`sheet_id`, `competence_id`, `created_at`)
SELECT t.`new_id`, s.`competence_id`, s.`created_at`
FROM `tmp_sheet_copies` t JOIN `sheet_competences` s ON s.`sheet_id` = t.`source_sheet_id`;--> statement-breakpoint
INSERT INTO `sheet_equipements` (`sheet_id`, `equipement_id`, `created_at`)
SELECT t.`new_id`, s.`equipement_id`, s.`created_at`
FROM `tmp_sheet_copies` t JOIN `sheet_equipements` s ON s.`sheet_id` = t.`source_sheet_id`;--> statement-breakpoint
INSERT INTO `sheet_sorts` (`sheet_id`, `sort_id`, `created_at`)
SELECT t.`new_id`, s.`sort_id`, s.`created_at`
FROM `tmp_sheet_copies` t JOIN `sheet_sorts` s ON s.`sheet_id` = t.`source_sheet_id`;--> statement-breakpoint
INSERT INTO `sheet_miracles` (`sheet_id`, `miracle_id`, `created_at`)
SELECT t.`new_id`, s.`miracle_id`, s.`created_at`
FROM `tmp_sheet_copies` t JOIN `sheet_miracles` s ON s.`sheet_id` = t.`source_sheet_id`;--> statement-breakpoint

DROP TEMPORARY TABLE `tmp_sheet_copies`;--> statement-breakpoint

-- 4. Supprime les fiches orphelines (jamais rattachées à une campagne). Les lignes filles partent
--    en cascade (FK ON DELETE cascade sur sheet_id).
DELETE FROM `character_sheets` WHERE `campaign_id` IS NULL;--> statement-breakpoint

-- 5. Verrouille le modèle : campaign_id NOT NULL + FK (cascade) + index. Le DEFAULT du status est
--    retiré (les nouvelles fiches fourniront explicitement PENDING/ACCEPTED depuis l'application).
ALTER TABLE `character_sheets` MODIFY `campaign_id` char(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `character_sheets` MODIFY `campaign_link_status` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `character_sheets` ADD CONSTRAINT `character_sheets_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_character_sheets_campaign_id` ON `character_sheets` (`campaign_id`);--> statement-breakpoint

-- 6. Le N‑N disparaît : suppression de la table de liaison.
DROP TABLE `campaign_characters`;
