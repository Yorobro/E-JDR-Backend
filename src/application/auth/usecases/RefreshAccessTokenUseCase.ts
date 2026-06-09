import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { InvalidRefreshTokenError } from "@application/auth/errors/InvalidRefreshTokenError";
import { RefreshAccessTokenCommand } from "@application/auth/commands/RefreshAccessTokenCommand";
import {
  IRefreshAccessTokenUseCase,
  RefreshAccessTokenResult,
} from "@application/auth/abstractions/usecases/IRefreshAccessTokenUseCase";
import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
import { IRefreshTokenRepository } from "@application/auth/abstractions/repositories/IRefreshTokenRepository";
import { ITokenProvider } from "@application/auth/abstractions/services/ITokenProvider";
import { ITokenHasher } from "@application/auth/abstractions/services/ITokenHasher";
import { IAuthTokenService } from "@application/auth/abstractions/services/IAuthTokenService";
import { IUnitOfWork } from "@application/shared/IUnitOfWork";

/**
 * Use case de rafraîchissement des jetons (avec rotation des refresh tokens).
 *
 * Orchestration pure :
 * 1. vérifie la signature/expiration du refresh token ;
 * 2. vérifie sa présence en base (un token absent = révoqué) ;
 * 3. révoque l'ancien token (rotation) ;
 * 4. émet une nouvelle paire de jetons via le service partagé.
 *
 * Toute incohérence (signature, expiration, absence en base, utilisateur introuvable)
 * renvoie une unique erreur métier {@link InvalidRefreshTokenError}.
 */
export class RefreshAccessTokenUseCase implements IRefreshAccessTokenUseCase {
  /**
   * @param userRepository - Port de persistance des utilisateurs.
   * @param refreshTokenRepository - Port de persistance des refresh tokens.
   * @param tokenProvider - Port de vérification du refresh token.
   * @param tokenHasher - Port de hachage déterministe (recherche/révocation par empreinte).
   * @param authTokenService - Service partagé d'émission des nouveaux jetons.
   * @param unitOfWork - Unité de travail : rend la rotation (révocation + réémission) atomique.
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenProvider: ITokenProvider,
    private readonly tokenHasher: ITokenHasher,
    private readonly authTokenService: IAuthTokenService,
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  /**
   * @inheritdoc
   */
  public async execute(
    command: RefreshAccessTokenCommand,
  ): Promise<Result<RefreshAccessTokenResult, AppError>> {
    const payload = this.tokenProvider.verifyRefreshToken(command.refreshToken);
    if (payload === null) {
      return Result.failure(new InvalidRefreshTokenError());
    }

    const isStored = await this.isRefreshTokenStored(command.refreshToken);
    if (!isStored) {
      return Result.failure(new InvalidRefreshTokenError());
    }

    // L'utilisateur est rechargé par son identifiant (claim `userId`), clé naturelle de
    // l'identité métier ; on s'assure qu'il existe toujours avant de réémettre des jetons.
    const user = await this.userRepository.findById(payload.userId);
    if (user === null) {
      return Result.failure(new InvalidRefreshTokenError());
    }

    // Rotation atomique : la révocation de l'ancien token et la persistance du nouveau
    // (via `issueTokens` + repo transactionnel) partagent une seule transaction.
    const tokens = await this.unitOfWork.execute(async (repos) => {
      const oldTokenHash = this.tokenHasher.hash(command.refreshToken);
      await repos.refreshTokens.deleteByTokenHash(oldTokenHash);
      return this.authTokenService.issueTokens(payload.userId, payload.email, repos.refreshTokens);
    });

    await this.purgeExpiredTokens();

    return Result.success({ tokens });
  }

  /**
   * Purge d'entretien, opportuniste : supprime les refresh tokens déjà expirés.
   *
   * Greffée sur le flux de rafraîchissement (événement peu fréquent) pour éviter une
   * croissance illimitée de la table sans introduire de planificateur. Best-effort : une
   * éventuelle erreur de purge ne doit pas faire échouer le rafraîchissement lui-même.
   */
  private async purgeExpiredTokens(): Promise<void> {
    try {
      await this.refreshTokenRepository.deleteExpired(new Date());
    } catch {
      // Purge non critique : on ignore silencieusement un échec de maintenance.
    }
  }

  /**
   * Vérifie qu'un refresh token est bien présent en base (donc non révoqué).
   *
   * @param rawRefreshToken - Le refresh token brut.
   * @returns `true` si une empreinte correspondante existe en base, `false` sinon.
   */
  private async isRefreshTokenStored(rawRefreshToken: string): Promise<boolean> {
    const tokenHash = this.tokenHasher.hash(rawRefreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    return stored !== null;
  }
}
