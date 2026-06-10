import { User } from "@domain/features/auth/entities/User";
import { UserRow } from "@infrastructure/persistence/mysql/features/auth/dao/UserDao";

/**
 * Traduit entre la représentation **persistance** (`UserRow`) et l'**entité domaine** (`User`).
 *
 * Isoler le mapping ici garde les repositories lisibles et confine toute connaissance du
 * schéma SQL hors du domaine. Le mapper est sans état : ses méthodes sont statiques.
 */
export class UserMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine `User`.
   *
   * @param row - La ligne `users` issue de la base.
   * @returns L'entité `User` reconstruite.
   */
  public static toDomain(row: UserRow): User {
    return User.restore({
      id: row.id,
      createdAt: new Date(row.created_at),
    });
  }

  /**
   * Convertit une entité domaine `User` en valeurs de colonnes prêtes pour l'insertion.
   *
   * @param user - L'entité `User` à persister.
   * @returns Un objet dont les clés correspondent aux colonnes de la table `users`.
   */
  public static toRow(user: User): { id: string; created_at: Date } {
    return {
      id: user.id,
      created_at: user.createdAt,
    };
  }
}


