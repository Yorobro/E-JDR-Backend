import { IUserRepository } from "@application/features/auth/abstractions/repositories/IUserRepository";
import { ICredentialRepository } from "@application/features/auth/abstractions/repositories/ICredentialRepository";
import { IRefreshTokenRepository } from "@application/features/auth/abstractions/repositories/IRefreshTokenRepository";

/**
 * Jeu de repositories liés à une même transaction, fournis au callback d'un `UnitOfWork`.
 *
 * Exposé « au besoin » : seuls les repos réellement utilisés dans des écritures
 * transactionnelles figurent ici. Un nouveau domaine (ex. campaign) ajoutera ses repos.
 */
export interface TransactionalRepositories {
  readonly users: IUserRepository;
  readonly credentials: ICredentialRepository;
  readonly refreshTokens: IRefreshTokenRepository;
}

/**
 * Port « out » d'unité de travail (Unit of Work).
 *
 * Règle d'architecture : **toute écriture** en base passe par `execute()`. Le callback
 * reçoit des repos liés à la transaction ; s'il lève, tout est annulé (rollback global),
 * sinon tout est validé (commit). Les lectures pures n'ont pas besoin du UnitOfWork.
 */
export interface IUnitOfWork {
  execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}

