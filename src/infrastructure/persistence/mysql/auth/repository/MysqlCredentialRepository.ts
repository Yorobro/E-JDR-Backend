import { Credential } from "@domain/auth/entities/Credential";
import { Email } from "@domain/auth/value-objects/Email";
import { ICredentialRepository } from "@application/auth/abstractions/repositories/ICredentialRepository";
import { CredentialDao } from "@infrastructure/persistence/mysql/auth/dao/CredentialDao";
import { CredentialMapper } from "@infrastructure/persistence/mysql/auth/mappers/CredentialMapper";

/**
 * Implémentation MySQL du port `ICredentialRepository`.
 *
 * Rôle d'**assemblage** : délègue le SQL au `CredentialDao`, puis traduit les lignes brutes en
 * entités domaine via le `CredentialMapper`. Aucune requête SQL n'est écrite ici.
 */
export class MysqlCredentialRepository implements ICredentialRepository {
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
}
