import { Credential } from "@domain/auth/entities/Credential";
import { Email } from "@domain/auth/value-objects/Email";
import { HashedPassword } from "@domain/auth/value-objects/HashedPassword";
import { CredentialRow } from "@infrastructure/persistence/mysql/auth/dao/CredentialDao";

/**
 * Traduit entre la représentation **persistance** (`CredentialRow`) et l'**entité domaine**
 * (`Credential`).
 *
 * Isoler le mapping ici garde les repositories lisibles et confine toute connaissance du
 * schéma SQL hors du domaine. Le mapper est sans état : ses méthodes sont statiques.
 */
export class CredentialMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine `Credential`.
   *
   * @param row - La ligne `credentials` issue de la base.
   * @returns L'entité `Credential` reconstruite (via les value objects).
   */
  public static toDomain(row: CredentialRow): Credential {
    return Credential.restore({
      id: row.id,
      userId: row.user_id,
      email: Email.create(row.email),
      password: HashedPassword.fromHash(row.password_hash),
      createdAt: new Date(row.created_at),
    });
  }

  /**
   * Convertit une entité domaine `Credential` en valeurs de colonnes prêtes pour l'insertion.
   *
   * @param credential - L'entité `Credential` à persister.
   * @returns Un objet dont les clés correspondent aux colonnes de la table `credentials`.
   */
  public static toRow(credential: Credential): {
    id: string;
    user_id: string;
    email: string;
    password_hash: string;
    created_at: Date;
  } {
    return {
      id: credential.id,
      user_id: credential.userId,
      email: credential.email.value,
      password_hash: credential.password.value,
      created_at: credential.createdAt,
    };
  }
}
