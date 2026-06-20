import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { CredentialDao } from "@infrastructure/persistence/mysql/features/auth/dao/CredentialDao";
import { CredentialMapper } from "@infrastructure/persistence/mysql/features/auth/mappers/CredentialMapper";

/**
 * Implémentation MySQL du port `CredentialRepository`.
 *
 * Rôle d'**assemblage** : délègue le SQL au `CredentialDao`, puis traduit les lignes brutes en
 * entités domaine via le `CredentialMapper`. Aucune requête SQL n'est écrite ici.
 */
export class MysqlCredentialRepository implements CredentialRepository {
  /**
   * @param credentialDao - DAO de la table `credentials` (SQL pur).
   */
  constructor(private readonly credentialDao: CredentialDao) {}

  /**
   * @inheritdoc
   */
  public async findByEmail(email: Email): Promise<Credential | null> {
    const row = await this.credentialDao.findByEmail(email.value);
    return row === null ? null : CredentialMapper.toDomain(row);
  }

  /**
   * @inheritdoc
   */
  public async findByUserId(userId: string): Promise<Credential | null> {
    const row = await this.credentialDao.findByUserId(userId);
    return row === null ? null : CredentialMapper.toDomain(row);
  }

  /**
   * @inheritdoc
   */
  public async existsByEmail(email: Email): Promise<boolean> {
    return this.credentialDao.existsByEmail(email.value);
  }

  /**
   * @inheritdoc
   */
  public async save(credential: Credential): Promise<void> {
    await this.credentialDao.insert(CredentialMapper.toRow(credential));
  }

  /**
   * @inheritdoc
   */
  public async update(credential: Credential): Promise<void> {
    await this.credentialDao.update(credential.id, {
      failed_attempts: credential.failedAttempts,
      locked_until: credential.lockedUntil,
    });
  }

  /**
   * @inheritdoc
   */
  public async updateEmail(credential: Credential): Promise<void> {
    await this.credentialDao.updateEmail(credential.id, credential.email.value);
  }

  /**
   * @inheritdoc
   */
  public async updatePassword(credential: Credential): Promise<void> {
    await this.credentialDao.updatePassword(credential.id, credential.password.value);
  }
}
