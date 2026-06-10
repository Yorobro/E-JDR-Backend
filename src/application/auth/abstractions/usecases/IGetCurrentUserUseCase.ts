import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GetCurrentUserQuery } from "@application/auth/commands/GetCurrentUserQuery";

/**
 * Profil de l'utilisateur courant renvoyé par le use case.
 */
export interface CurrentUserResult {
  /** Identifiant de l'utilisateur. */
  readonly userId: string;
  /** Adresse e-mail du compte. */
  readonly email: string;
  /** Date de création du compte. */
  readonly createdAt: Date;
}

/**
 * Port d'entrée du use case de consultation du profil courant (`GET /me`).
 */
export interface IGetCurrentUserUseCase {
  /**
   * Récupère le profil de l'utilisateur authentifié.
   *
   * @param query - L'identifiant issu du jeton d'accès vérifié.
   * @returns Le profil, ou `UserNotFoundError` si le compte n'existe plus.
   */
  execute(query: GetCurrentUserQuery): Promise<Result<CurrentUserResult, AppError>>;
}
