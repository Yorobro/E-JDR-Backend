import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { UserNotFoundError } from "@application/auth/errors/UserNotFoundError";
import { GetCurrentUserQuery } from "@application/auth/commands/GetCurrentUserQuery";
import {
  CurrentUserResult,
  IGetCurrentUserUseCase,
} from "@application/auth/abstractions/usecases/IGetCurrentUserUseCase";
import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
import { ICredentialRepository } from "@application/auth/abstractions/repositories/ICredentialRepository";

/**
 * Use case de consultation du profil de l'utilisateur courant.
 *
 * Orchestration pure en **lecture seule** : pas d'UnitOfWork (réservé aux écritures).
 * Le `userId` provient du jeton vérifié en amont ; si l'utilisateur ou son credential
 * a disparu entre-temps (compte supprimé), la session est considérée invalide.
 */
export class GetCurrentUserUseCase implements IGetCurrentUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly credentialRepository: ICredentialRepository,
  ) {}

  public async execute(query: GetCurrentUserQuery): Promise<Result<CurrentUserResult, AppError>> {
    const user = await this.userRepository.findById(query.userId);
    if (user === null) {
      return Result.failure(new UserNotFoundError());
    }

    const credential = await this.credentialRepository.findByUserId(query.userId);
    if (credential === null) {
      return Result.failure(new UserNotFoundError());
    }

    return Result.success({
      userId: user.id,
      email: credential.email.value,
      createdAt: user.createdAt,
    });
  }
}
