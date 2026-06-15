import { User } from "@domain/features/auth/entities/User";
import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { HashedPassword } from "@domain/features/auth/value-objects/HashedPassword";
import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";
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
): CharacterSheet {
  return CharacterSheet.create({
    id,
    ownerId,
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
): Campaign {
  return Campaign.create({
    id,
    gameMasterId,
    name: CampaignName.create(name),
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
