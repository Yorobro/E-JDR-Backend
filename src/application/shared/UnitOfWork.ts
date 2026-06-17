import { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { RefreshTokenRepository } from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";

/**
 * Jeu de repositories liés à une même transaction, fournis au callback d'un `UnitOfWork`.
 *
 * Exposé « au besoin » : seuls les repos réellement utilisés dans des écritures
 * transactionnelles figurent ici. Un nouveau domaine (ex. campaign) ajoutera ses repos.
 */
export interface TransactionalRepositories {
  readonly users: UserRepository;
  readonly credentials: CredentialRepository;
  readonly refreshTokens: RefreshTokenRepository;
  readonly campaigns: CampaignRepository;
  readonly sessions: SessionRepository;
  readonly characterSheets: CharacterSheetRepository;
  readonly campaignCharacters: CampaignCharacterRepository;
}

/**
 * Port « out » d'unité de travail (Unit of Work).
 *
 * Règle d'architecture : **toute écriture** en base passe par `execute()`. Le callback
 * reçoit des repos liés à la transaction ; s'il lève, tout est annulé (rollback global),
 * sinon tout est validé (commit). Les lectures pures n'ont pas besoin du UnitOfWork.
 */
export interface UnitOfWork {
  execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
