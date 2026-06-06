import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { LogoutUserCommand } from "@application/auth/commands/LogoutUserCommand";
import { ILogoutUserUseCase } from "@application/auth/abstractions/usecases/ILogoutUserUseCase";
import { IRefreshTokenRepository } from "@application/auth/abstractions/repositories/IRefreshTokenRepository";
import { ITokenHasher } from "@application/auth/abstractions/services/ITokenHasher";

/**
 * Use case de déconnexion.
 *
 * Orchestration pure : révoque le refresh token côté serveur en supprimant son empreinte
 * de la base. L'opération est **idempotente** — révoquer un token déjà absent réussit, car
 * l'objectif (« ce token ne doit plus être valide ») est atteint dans tous les cas.
 */
export class LogoutUserUseCase implements ILogoutUserUseCase {
  /**
   * @param refreshTokenRepository - Port de persistance des refresh tokens.
   * @param tokenHasher - Port de hachage déterministe pour retrouver l'empreinte à supprimer.
   */
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenHasher: ITokenHasher,
  ) {}

  /**
   * @inheritdoc
   */
  public async execute(command: LogoutUserCommand): Promise<Result<void, AppError>> {
    const tokenHash = this.tokenHasher.hash(command.refreshToken);
    await this.refreshTokenRepository.deleteByTokenHash(tokenHash);

    return Result.success(undefined);
  }
}
