-- Backfill : recopie le couple (stat, bonus) historique de chaque peuple vers la table de
-- jointure `peuple_stat_bonuses` créée par la migration 0012.
--
-- NON DESTRUCTIF : les colonnes `peoples`.`stat` et `peoples`.`bonus` sont CONSERVÉES.
-- Elles ne sont plus relues par le code (sinon le bonus serait compté deux fois), mais on ne les
-- supprime pas ici : les migrations s'exécutent automatiquement au démarrage du conteneur et la
-- base de production n'a aucune sauvegarde. Le DROP COLUMN fera l'objet d'un lot dédié, précédé
-- d'un backup.
--
-- Idempotent : INSERT IGNORE + PK composite (peuple_id, stat) ⇒ rejouer la migration ne duplique
-- rien. Un peuple dont la stat est renseignée mais le bonus est NULL retombe sur le défaut métier
-- (1), cohérent avec le value object StatBonus.

INSERT IGNORE INTO `peuple_stat_bonuses` (`peuple_id`, `stat`, `bonus`, `created_at`)
SELECT
	p.`id`,
	p.`stat`,
	COALESCE(p.`bonus`, 1),
	COALESCE(p.`created_at`, NOW())
FROM `peoples` p
WHERE p.`stat` IS NOT NULL AND p.`stat` <> '';
