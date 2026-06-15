import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { UserNotFoundError } from "@application/features/auth/errors/UserNotFoundError";
import { GetCurrentUserQuery } from "@application/features/auth/query/GetCurrentUserQuery";
import {
  CurrentUserResult,
  GetCurrentUserUseCase,
} from "@application/features/auth/abstractions/usecases/GetCurrentUserUseCase";
import { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";

/**
 * Use case de consultation du profil de l'utilisateur courant.
 *
 * Orchestration pure en **lecture seule** : pas d'UnitOfWork (réservé aux écritures).
 * Le `userId` provient du jeton vérifié en amont ; si l'utilisateur ou son credential
 * a disparu entre-temps (compte supprimé), la session est considérée invalide.
 */
export class GetCurrentUserUseCaseImpl implements GetCurrentUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly credentialRepository: CredentialRepository,
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
      pseudo: user.pseudo,
      createdAt: user.createdAt,
    });
  }
}
