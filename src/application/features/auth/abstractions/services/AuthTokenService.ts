import { RefreshTokenRepository } from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";

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
 * Jeton d'accès seul, émis pour renouveler une session existante sans toucher au refresh token.
 *
 * Résultat « token » du rafraîchissement : seul l'access token est régénéré ; le refresh token
 * de la session reste celui déjà détenu par le client (modèle multi-appareils sans rotation).
 */
export interface AccessTokenOnly {
  /** Le jeton d'accès signé (durée de vie courte). */
  readonly accessToken: string;
  /** Date d'expiration de l'access token. */
  readonly accessTokenExpiresAt: Date;
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
export interface AuthTokenService {
  /**
   * Émet une nouvelle paire de jetons pour une identité authentifiée et persiste le refresh token.
   *
   * Prend l'`userId` et l'`email` séparément car ils proviennent désormais de deux entités
   * distinctes (`User` pour l'identité, `Credential` pour l'e-mail) : le service ne dépend
   * ainsi d'aucune des deux, seulement des claims à encoder.
   *
   * Utilisé à l'ouverture d'une **nouvelle** session (register, login) : un refresh token est
   * créé et persisté. Le rafraîchissement d'une session existante utilise {@link issueAccessToken}.
   *
   * @param userId - Identifiant de l'utilisateur authentifié (claim `userId`).
   * @param email - Adresse e-mail de l'utilisateur authentifié (claim `email`).
   * @param refreshTokenRepo - Repo transactionnel optionnel : quand fourni, la persistance du
   *   refresh token l'utilise (au lieu du repo injecté), afin de partager une transaction avec
   *   l'appelant.
   * @returns La paire de jetons (access + refresh) avec leurs dates d'expiration.
   */
  issueTokens(
    userId: string,
    email: string,
    refreshTokenRepo?: RefreshTokenRepository,
  ): Promise<AuthTokens>;

  /**
   * Émet **uniquement** un nouvel access token pour une session déjà ouverte.
   *
   * Contrairement à {@link issueTokens}, ne crée ni ne persiste de refresh token : la session
   * conserve son refresh token existant. C'est ce qui permet à plusieurs appareils du même
   * utilisateur de coexister — rafraîchir l'un n'invalide pas la session des autres (pas de
   * rotation destructive d'un token partagé).
   *
   * @param userId - Identifiant de l'utilisateur authentifié (claim `userId`).
   * @param email - Adresse e-mail de l'utilisateur authentifié (claim `email`).
   * @returns Le nouvel access token et sa date d'expiration.
   */
  issueAccessToken(userId: string, email: string): AccessTokenOnly;
}
