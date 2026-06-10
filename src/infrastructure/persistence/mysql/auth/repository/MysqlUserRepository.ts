import { User } from "@domain/auth/entities/User";
import { IUserRepository } from "@application/features/auth/abstractions/repositories/IUserRepository";
import { UserDao } from "@infrastructure/persistence/mysql/features/auth/dao/UserDao";
import { UserMapper } from "@infrastructure/persistence/mysql/features/auth/mappers/UserMapper";

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
  public async findById(id: string): Promise<User | null> {
    const row = await this.userDao.findById(id);
    return row === null ? null : UserMapper.toDomain(row);
  }

  /**
   * @inheritdoc
   */
  public async save(user: User): Promise<void> {
    await this.userDao.insert(UserMapper.toRow(user));
  }
}

