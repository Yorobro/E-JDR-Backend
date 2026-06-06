/**
 * Charge utile (claims) encodée dans les jetons JWT émis par l'application.
 */
export interface TokenPayload {
  /** Identifiant de l'utilisateur (sujet du token). */
  readonly userId: string;
  /** Adresse e-mail de l'utilisateur (pratique pour la présentation, sans relire la BDD). */
  readonly email: string;
}

/**
 * Jeton signé accompagné de sa date d'expiration.
 */
export interface SignedToken {
  /** Le jeton signé (chaîne JWT). */
  readonly token: string;
  /** Date d'expiration absolue du jeton. */
  readonly expiresAt: Date;
}

/**
 * Port bas niveau de signature et vérification des jetons JWT (port « out »).
 *
 * Abstrait la librairie de JWT (`jsonwebtoken`) et la gestion des secrets/durées.
 * Distingue explicitement les tokens d'accès (courts) et de rafraîchissement (longs),
 * qui utilisent des secrets différents. L'implémentation concrète vit dans l'infrastructure.
 */
export interface ITokenProvider {
  /**
   * Signe un **access token** (durée de vie courte).
   *
   * @param payload - Les claims à encoder dans le token.
   * @returns Le token signé et sa date d'expiration.
   */
  signAccessToken(payload: TokenPayload): SignedToken;

  /**
   * Signe un **refresh token** (durée de vie longue).
   *
   * @param payload - Les claims à encoder dans le token.
   * @returns Le token signé et sa date d'expiration.
   */
  signRefreshToken(payload: TokenPayload): SignedToken;

  /**
   * Vérifie et décode un **access token**.
   *
   * @param token - Le token d'accès à vérifier.
   * @returns La charge utile décodée, ou `null` si le token est invalide/expiré.
   */
  verifyAccessToken(token: string): TokenPayload | null;

  /**
   * Vérifie et décode un **refresh token**.
   *
   * @param token - Le token de rafraîchissement à vérifier.
   * @returns La charge utile décodée, ou `null` si le token est invalide/expiré.
   */
  verifyRefreshToken(token: string): TokenPayload | null;
}
