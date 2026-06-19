import { User } from "@domain/features/auth/entities/User";
import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { HashedPassword } from "@domain/features/auth/value-objects/HashedPassword";
import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";
import { Session } from "@domain/features/session/entities/Session";
import { SessionTitle } from "@domain/features/session/value-objects/SessionTitle";
import { SessionDate } from "@domain/features/session/value-objects/SessionDate";
import { ReferenceItem } from "@domain/features/reference/entities/ReferenceItem";
import { ReferenceName } from "@domain/features/reference/value-objects/ReferenceName";
import {
  CharacterSheet,
  CharacterSheetDetails,
} from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";

/**
 * Fabriques de données de test (entités domaine pré-construites).
 *
 * Séparées des doublures de ports (`fakes.ts`) pour garder chaque module focalisé et sous le
 * seuil de taille. Re-exportées par `fakes.ts` pour ne pas casser les imports existants.
 */

/**
 * Aide de test : construit une fiche de personnage.
 *
 * @param id - L'identifiant de la fiche (par défaut "sheet-1").
 * @param ownerId - L'identifiant du propriétaire (par défaut "user-1").
 * @param name - Le nom de la fiche (par défaut "Aragorn").
 * @param details - Champs détaillés optionnels (identité, caractéristiques, textes longs).
 * @returns Une entité `CharacterSheet` prête pour les tests.
 */
export function buildTestCharacterSheet(
  id = "sheet-1",
  ownerId = "user-1",
  name = "Aragorn",
  details: Partial<CharacterSheetDetails> = {},
  groupId = "group-1",
): CharacterSheet {
  return CharacterSheet.create({
    id,
    ownerId,
    groupId,
    name: CharacterSheetName.create(name),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...details,
  });
}

/**
 * Aide de test : construit une campagne.
 *
 * @param id - L'identifiant de la campagne (par défaut "campaign-1").
 * @param gameMasterId - L'identifiant du MJ propriétaire (par défaut "user-1").
 * @param name - Le nom de la campagne (par défaut "Ma campagne").
 * @returns Une entité `Campaign` prête pour les tests.
 */
export function buildTestCampaign(
  id = "campaign-1",
  gameMasterId = "user-1",
  name = "Ma campagne",
  groupId = "group-1",
): Campaign {
  return Campaign.create({
    id,
    groupId,
    gameMasterId,
    name: CampaignName.create(name),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
}

/**
 * Aide de test : construit une session rattachée à une campagne.
 *
 * @param id - L'identifiant de la session (par défaut "session-1").
 * @param campaignId - L'identifiant de la campagne parente (par défaut "campaign-1").
 * @param title - Le titre de la session (par défaut "Session 1").
 * @param date - La date de la session au format `YYYY-MM-DD` (par défaut "2026-06-20").
 * @returns Une entité `Session` prête pour les tests.
 */
export function buildTestSession(
  id = "session-1",
  campaignId = "campaign-1",
  title = "Session 1",
  date = "2026-06-20",
): Session {
  return Session.create({
    id,
    campaignId,
    title: SessionTitle.create(title),
    date: SessionDate.create(date).value,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
}

/**
 * Aide de test : construit un élément de référence (formation, peuple, arme, …).
 *
 * @param id - L'identifiant de l'élément (par défaut "ref-1").
 * @param groupId - L'identifiant du groupe propriétaire (par défaut "group-1").
 * @param name - Le nom de l'élément (par défaut "Élément").
 * @returns Une entité `ReferenceItem` prête pour les tests.
 */
export function buildTestReferenceItem(
  id = "ref-1",
  groupId = "group-1",
  name = "Élément",
): ReferenceItem {
  return ReferenceItem.create({
    id,
    groupId,
    name: ReferenceName.create(name),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
}

/**
 * Aide de test : construit un utilisateur métier.
 *
 * @param id - L'identifiant (par défaut "user-1").
 * @param pseudo - Le pseudo (par défaut "Joueur").
 * @returns Une entité `User` prête pour les tests.
 */
export function buildTestUser(id = "user-1", pseudo = "Joueur"): User {
  return User.create({ id, pseudo, createdAt: new Date("2025-01-01T00:00:00Z") });
}

/**
 * Aide de test : construit un identifiant d'authentification avec un mot de passe déjà
 * "haché" par le fake hasher.
 *
 * @param email - L'e-mail du compte.
 * @param plainPassword - Le mot de passe en clair (sera préfixé "hashed:").
 * @param userId - L'identifiant de l'utilisateur rattaché (par défaut "user-1").
 * @param id - L'identifiant de l'enregistrement (par défaut "cred-1").
 * @returns Une entité `Credential` prête pour les tests.
 */
export function buildTestCredential(
  email: string,
  plainPassword: string,
  userId = "user-1",
  id = "cred-1",
): Credential {
  return Credential.create({
    id,
    userId,
    email: Email.create(email),
    password: HashedPassword.fromHash(`hashed:${plainPassword}`),
    createdAt: new Date("2025-01-01T00:00:00Z"),
  });
}
