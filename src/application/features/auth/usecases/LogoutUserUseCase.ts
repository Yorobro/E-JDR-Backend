import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { LogoutUserCommand } from "@application/features/auth/commands/LogoutUserCommand";
import { ILogoutUserUseCase } from "@application/features/auth/abstractions/usecases/ILogoutUserUseCase";
import { ITokenHasher } from "@application/features/auth/abstractions/services/ITokenHasher";
import { IUnitOfWork } from "@application/shared/IUnitOfWork";

/**
 * Use case de déconnexion.
 *
 * Révoque le refresh token côté serveur en supprimant son empreinte de la base, via le
 * `UnitOfWork`. L'opération est **idempotente** — révoquer un token déjà absent réussit.
 */
export class LogoutUserUseCase implements ILogoutUserUseCase {
  constructor(
    private readonly tokenHasher: ITokenHasher,
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  public async execute(command: LogoutUserCommand): Promise<Result<void, AppError>> {
    const tokenHash = this.tokenHasher.hash(command.refreshToken);
    await this.unitOfWork.execute((repos) => repos.refreshTokens.deleteByTokenHash(tokenHash));

    return Result.success(undefined);
  }
}


