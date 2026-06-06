import { User } from "@domain/auth/entities/User";
import { Email } from "@domain/auth/value-objects/Email";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";
import { UserRow } from "@infrastructure/persistence/mysql/auth/dao/UserDao";

/**
 * Traduit entre la représentation **persistance** (`UserRow`) et l'**entité domaine** (`User`).
 *
 * Isoler le mapping ici garde les repositories lisibles (orchestration DAO + mapping) et
 * confine toute connaissance du schéma SQL hors du domaine. Le mapper est sans état :
 * ses méthodes sont statiques.
 */
export class UserMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine `User`.
   *
   * @param row - La ligne `users` issue de la base.
   * @returns L'entité `User` reconstruite (via les value objects).
   */
  public static toDomain(row: UserRow): User {
    return User.restore({
      id: row.id,
      email: Email.create(row.email),
      password: HashedPassword.fromHash(row.password_hash),
      createdAt: new Date(row.created_at),
    });
  }

  /**
   * Convertit une entité domaine `User` en valeurs de colonnes prêtes pour l'insertion.
   *
   * @param user - L'entité `User` à persister.
   * @returns Un objet dont les clés correspondent aux colonnes de la table `users`.
   */
  public static toRow(user: User): {
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
  } {
    return {
      id: user.id,
      email: user.email.value,
      password_hash: user.password.value,
      created_at: user.createdAt,
    };
  }
}
