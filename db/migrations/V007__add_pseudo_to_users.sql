-- Migration V007 — Ajout du pseudo (nom d'affichage) à l'utilisateur.
--
-- Le pseudo est REQUIS à l'inscription (NOT NULL). Pour que l'ALTER réussisse même si la base de
-- dev contient déjà des comptes de test, on ajoute la colonne avec un défaut transitoire ('') qui
-- rétro-remplit les lignes existantes, PUIS on retire ce défaut : tout NOUVEL insert devra donc
-- fournir un pseudo réel (l'application le fait toujours).
--
-- ⚠️ Les comptes de test existants se retrouveront avec un pseudo vide : les recréer en dev.
-- ⚠️ Numéro V007 à coordonner avec l'équipe avant merge (cf. db/MIGRATION.md).

ALTER TABLE users
    ADD COLUMN pseudo VARCHAR(50) NOT NULL DEFAULT '';

ALTER TABLE users
    ALTER COLUMN pseudo DROP DEFAULT;
