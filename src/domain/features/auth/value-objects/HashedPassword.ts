import { InvalidHashError } from "@domain/features/auth/errors/InvalidHashError";

/**
 * Value Object représentant un mot de passe **déjà haché**.
 *
 * Son unique raison d'être est la sûreté de typage : tant qu'une fonction attend un
 * `HashedPassword` (et non une `string`), il est impossible d'y glisser par erreur un
 * mot de passe en clair. Le domaine ne sait PAS hacher (cela dépendrait de bcrypt) :
 * le hachage est délégué à un port `IPasswordHasher` côté application, qui produit ensuite
 * ce value object.
 *
 * Le VO est immuable.
 */
export class HashedPassword {
  /**
   * @param value - L'empreinte (hash) du mot de passe, telle que produite par l'algorithme.
   *                Constructeur privé : on passe par {@link HashedPassword.fromHash}.
   */
  private constructor(public readonly value: string) {}

  /**
   * Reconstruit un `HashedPassword` à partir d'une empreinte existante.
   *
   * Utilisé aussi bien après le hachage d'un nouveau mot de passe que lors de la
   * relecture d'un utilisateur depuis la base de données.
   *
   * @param hash - L'empreinte du mot de passe (non vide).
   * @returns Une instance de `HashedPassword`.
   * @throws {InvalidHashError} Si l'empreinte est vide (anomalie de persistance).
   */
  public static fromHash(hash: string): HashedPassword {
    if (hash.length === 0) {
      throw new InvalidHashError();
    }

    return new HashedPassword(hash);
  }

  /**
   * @returns La représentation textuelle (l'empreinte). Utilisé pour la persistance.
   */
  public toString(): string {
    return this.value;
  }
}


