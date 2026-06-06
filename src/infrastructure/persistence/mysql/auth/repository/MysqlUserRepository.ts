import { User } from "@domain/auth/entities/User";
import { Email } from "@domain/auth/value-objects/Email";
import { IUserRepository } from "@application/auth/abstractions/repositories/IUserRepository";
import { UserDao } from "@infrastructure/persistence/mysql/auth/dao/UserDao";
import { UserMapper } from "@infrastructure/persistence/mysql/auth/mappers/UserMapper";

/**
 * Implémentation MySQL du port `IUserRepository`.
 *
 * Rôle d'**assemblage** : délègue le SQL au `UserDao`, puis traduit les lignes brutes en
 * entités domaine via le `UserMapper`. Aucune requête SQL n'est écrite ici.
 */
export class MysqlUserRepository implements IUserRepository {
  /**
   * @param userDao - DAO de la table `users` (SQL pur).
   */
  constructor(private readonly userDao: UserDao) {}

  /**
   * @inheritdoc
   */
  public async findByEmail(email: Email): Promise<User | null> {
    const row = await this.userDao.findByEmail(email.value);
    return row === null ? null : UserMapper.toDomain(row);
  }

  /**
   * @inheritdoc
   */
  public async existsByEmail(email: Email): Promise<boolean> {
    return this.userDao.existsByEmail(email.value);
  }

  /**
   * @inheritdoc
   */
  public async save(user: User): Promise<void> {
    await this.userDao.insert(UserMapper.toRow(user));
  }
}
