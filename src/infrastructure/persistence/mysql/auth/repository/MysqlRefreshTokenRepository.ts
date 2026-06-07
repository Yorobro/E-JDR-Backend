import {
  IRefreshTokenRepository,
  StoredRefreshToken,
} from "@application/auth/abstractions/repositories/IRefreshTokenRepository";
import {
  RefreshTokenDao,
  RefreshTokenRow,
} from "@infrastructure/persistence/mysql/auth/dao/RefreshTokenDao";

/**
 * Implémentation MySQL du port `IRefreshTokenRepository`.
 *
 * Rôle d'**assemblage** : délègue le SQL au `RefreshTokenDao` et traduit les lignes brutes
 * vers le modèle applicatif `StoredRefreshToken`. La date de création est gérée ici, au
 * moment de la persistance.
 */
export class MysqlRefreshTokenRepository implements IRefreshTokenRepository {
  /**
   * @param refreshTokenDao - DAO de la table `refresh_tokens` (SQL pur).
   */
  constructor(private readonly refreshTokenDao: RefreshTokenDao) {}

  /**
   * @inheritdoc
   */
  public async save(token: StoredRefreshToken): Promise<void> {
    await this.refreshTokenDao.insert({
      id: token.id,
      user_id: token.userId,
      token_hash: token.tokenHash,
      expires_at: token.expiresAt,
      created_at: new Date(),
    });
  }

  /**
   * @inheritdoc
   */
  public async findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const row = await this.refreshTokenDao.findByTokenHash(tokenHash);
    return row === null ? null : this.toStoredRefreshToken(row);
  }

  /**
   * @inheritdoc
   */
  public async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.refreshTokenDao.deleteByTokenHash(tokenHash);
  }

  /**
   * @inheritdoc
   */
  public async deleteAllForUser(userId: string): Promise<void> {
    await this.refreshTokenDao.deleteAllForUser(userId);
  }

  /**
   * @inheritdoc
   */
  public async deleteExpired(now: Date): Promise<void> {
    await this.refreshTokenDao.deleteExpired(now);
  }

  /**
   * Traduit une ligne SQL brute vers le modèle applicatif `StoredRefreshToken`.
   *
   * @param row - La ligne `refresh_tokens` issue de la base.
   * @returns Le modèle applicatif correspondant.
   */
  private toStoredRefreshToken(row: RefreshTokenRow): StoredRefreshToken {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
    };
  }
}
