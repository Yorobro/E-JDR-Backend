import { User } from "@domain/auth/entities/User";

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
import { Email } from "@domain/auth/value-objects/Email";

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
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenProvider: ITokenProvider,
    private readonly tokenHasher: ITokenHasher,
    private readonly authTokenService: IAuthTokenService,
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

    const user = await this.loadUser(payload.email);
    if (user === null) {
      return Result.failure(new InvalidRefreshTokenError());
    }

    await this.rotate(command.refreshToken, user);

    const tokens = await this.authTokenService.issueTokensForUser(user);
    return Result.success({ tokens });
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

  /**
   * Recharge l'utilisateur associé au token à partir de son e-mail.
   *
   * @param rawEmail - L'e-mail issu de la charge utile du token.
   * @returns L'utilisateur correspondant, ou `null` s'il n'existe plus.
   */
  private async loadUser(rawEmail: string): Promise<User | null> {
    return this.userRepository.findByEmail(Email.create(rawEmail));
  }

  /**
   * Applique la rotation : révoque l'ancien refresh token. La nouvelle paire est ensuite
   * émise par le service appelant. Révoquer avant d'émettre garantit qu'un token ne peut
   * pas être réutilisé.
   *
   * @param oldRefreshToken - Le refresh token courant à révoquer.
   * @param user - L'utilisateur concerné (réservé pour d'éventuelles règles de rotation).
   */
  private async rotate(oldRefreshToken: string, _user: User): Promise<void> {
    const oldTokenHash = this.tokenHasher.hash(oldRefreshToken);
    await this.refreshTokenRepository.deleteByTokenHash(oldTokenHash);
  }
}
