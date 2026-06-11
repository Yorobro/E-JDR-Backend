import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { LogoutUserCommand } from "@application/features/auth/commands/LogoutUserCommand";
import { LogoutUserUseCase } from "@application/features/auth/abstractions/usecases/LogoutUserUseCase";
import { TokenHasherService } from "@application/features/auth/abstractions/services/TokenHasherService";
import { UnitOfWork } from "@application/shared/UnitOfWork";

/**
 * Use case de déconnexion.
 *
 * Révoque le refresh token côté serveur en supprimant son empreinte de la base, via le
 * `UnitOfWork`. L'opération est **idempotente** — révoquer un token déjà absent réussit.
 */
export class LogoutUserUseCaseImpl implements LogoutUserUseCase {
  constructor(
    private readonly tokenHasher: TokenHasherService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  public async execute(command: LogoutUserCommand): Promise<Result<void, AppError>> {
    const tokenHash = this.tokenHasher.hash(command.refreshToken);
    await this.unitOfWork.execute((repos) => repos.refreshTokens.deleteByTokenHash(tokenHash));

    return Result.success(undefined);
  }
}
