import { User } from "@domain/auth/entities/User";

/**
 * Paire de jetons émise pour une session authentifiée, avec leurs expirations.
 *
 * Ce type est le résultat « token » partagé entre les use cases (register, login, refresh)
 * et consommé par la couche présentation pour positionner les cookies.
 */
export interface AuthTokens {
  /** Le jeton d'accès signé (durée de vie courte). */
  readonly accessToken: string;
  /** Date d'expiration de l'access token. */
  readonly accessTokenExpiresAt: Date;
  /** Le jeton de rafraîchissement signé (durée de vie longue). */
  readonly refreshToken: string;
  /** Date d'expiration du refresh token. */
  readonly refreshTokenExpiresAt: Date;
}

/**
 * Service applicatif d'émission des jetons d'authentification (port « in » de service).
 *
 * Il **factorise** la logique commune à plusieurs use cases : « générer un access token et
 * un refresh token, puis persister (l'empreinte du) refresh token en base ». Cela respecte
 * la règle « un use case ne peut pas appeler un autre use case » : la logique partagée vit
 * dans un service, pas dans un autre use case.
 *
 * Utilisé par `RegisterUserUseCase`, `LoginUserUseCase` et `RefreshAccessTokenUseCase`.
 */
export interface IAuthTokenService {
  /**
   * Émet une nouvelle paire de jetons pour un utilisateur et persiste le refresh token.
   *
   * @param user - L'utilisateur authentifié pour lequel émettre les jetons.
   * @returns La paire de jetons (access + refresh) avec leurs dates d'expiration.
   */
  issueTokensForUser(user: User): Promise<AuthTokens>;
}
