import {
  AuthTokens,
  IAuthTokenService,
} from "@application/auth/abstractions/services/IAuthTokenService";
import { ITokenProvider } from "@application/auth/abstractions/services/ITokenProvider";
import { ITokenHasher } from "@application/auth/abstractions/services/ITokenHasher";
import { IIdGenerator } from "@application/auth/abstractions/services/IIdGenerator";
import { IRefreshTokenRepository } from "@application/auth/abstractions/repositories/IRefreshTokenRepository";

/**
 * Implémentation du service d'émission des jetons d'authentification.
 *
 * Centralise la logique partagée par les use cases register/login/refresh :
 * 1. signer un access token et un refresh token ;
 * 2. persister l'empreinte du refresh token en base (pour permettre sa révocation).
 *
 * En tant que **service**, il a le droit d'être appelé par plusieurs use cases (ce qu'un
 * use case ne pourrait pas faire vis-à-vis d'un autre use case).
 */
export class AuthTokenService implements IAuthTokenService {
  /**
   * @param tokenProvider - Port de signature/vérification des JWT.
   * @param tokenHasher - Port de hachage déterministe pour l'empreinte du refresh token.
   * @param idGenerator - Port de génération d'identifiants (pour la ligne refresh_tokens).
   * @param refreshTokenRepository - Port de persistance des refresh tokens.
   */
  constructor(
    private readonly tokenProvider: ITokenProvider,
    private readonly tokenHasher: ITokenHasher,
    private readonly idGenerator: IIdGenerator,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  /**
   * @inheritdoc
   *
   * Signe la paire de jetons pour l'identité fournie, persiste l'empreinte du refresh token,
   * puis retourne les jetons bruts (à transmettre au client via cookies).
   */
  public async issueTokens(
    userId: string,
    email: string,
    refreshTokenRepo?: IRefreshTokenRepository,
  ): Promise<AuthTokens> {
    const payload = { userId, email };

    const accessToken = this.tokenProvider.signAccessToken(payload);
    const refreshToken = this.tokenProvider.signRefreshToken(payload);

    await this.persistRefreshToken(
      userId,
      refreshToken.token,
      refreshToken.expiresAt,
      refreshTokenRepo ?? this.refreshTokenRepository,
    );

    return {
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: refreshToken.expiresAt,
    };
  }

  /**
   * Persiste l'empreinte d'un refresh token afin de pouvoir le révoquer ultérieurement.
   *
   * @param userId - Identifiant du propriétaire du token.
   * @param rawRefreshToken - Le refresh token brut (jamais stocké tel quel).
   * @param expiresAt - Date d'expiration du token.
   * @param repo - Repo de persistance à utiliser (injecté ou transactionnel selon l'appelant).
   */
  private async persistRefreshToken(
    userId: string,
    rawRefreshToken: string,
    expiresAt: Date,
    repo: IRefreshTokenRepository,
  ): Promise<void> {
    await repo.save({
      id: this.idGenerator.generate(),
      userId,
      tokenHash: this.tokenHasher.hash(rawRefreshToken),
      expiresAt,
    });
  }
}
