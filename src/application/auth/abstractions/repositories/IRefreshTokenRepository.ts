/**
 * Représentation d'un refresh token tel qu'il est **persisté** côté serveur.
 *
 * Pour des raisons de sécurité, on ne stocke jamais le token brut mais son empreinte
 * (`tokenHash`). La présence d'une ligne correspondante en base est ce qui rend un refresh
 * token « valide » : le supprimer revient à le révoquer (logout, rotation).
 */
export interface StoredRefreshToken {
  /** Identifiant unique de l'enregistrement du token. */
  readonly id: string;
  /** Identifiant de l'utilisateur propriétaire du token. */
  readonly userId: string;
  /** Empreinte (hash) du refresh token — jamais le token en clair. */
  readonly tokenHash: string;
  /** Date d'expiration au-delà de laquelle le token n'est plus valide. */
  readonly expiresAt: Date;
}

/**
 * Port de persistance des refresh tokens (port « out »).
 *
 * Permet de stocker, retrouver et révoquer les refresh tokens afin de rendre la
 * déconnexion effective et de supporter la rotation des tokens. L'implémentation
 * concrète (MySQL) vit dans l'infrastructure.
 */
export interface IRefreshTokenRepository {
  /**
   * Persiste un nouveau refresh token (son empreinte).
   *
   * @param token - Les données du token à enregistrer.
   * @returns Une promesse résolue une fois le token enregistré.
   */
  save(token: StoredRefreshToken): Promise<void>;

  /**
   * Recherche un refresh token stocké à partir de son empreinte.
   *
   * @param tokenHash - L'empreinte du token recherché.
   * @returns L'enregistrement correspondant, ou `null` s'il est absent (donc révoqué/inexistant).
   */
  findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null>;

  /**
   * Supprime (révoque) un refresh token précis à partir de son empreinte.
   *
   * @param tokenHash - L'empreinte du token à révoquer.
   * @returns Une promesse résolue une fois la suppression effectuée.
   */
  deleteByTokenHash(tokenHash: string): Promise<void>;

  /**
   * Supprime (révoque) tous les refresh tokens d'un utilisateur donné.
   *
   * Utile pour une déconnexion globale ou la rotation après réutilisation suspecte.
   *
   * @param userId - L'identifiant de l'utilisateur dont on révoque les tokens.
   * @returns Une promesse résolue une fois les suppressions effectuées.
   */
  deleteAllForUser(userId: string): Promise<void>;
}
