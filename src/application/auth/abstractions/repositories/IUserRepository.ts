import { User } from "@domain/auth/entities/User";
import { Email } from "@domain/auth/value-objects/Email";

/**
 * Port de persistance des utilisateurs (port « out »).
 *
 * Définit le contrat que la couche application attend pour stocker et retrouver des `User`,
 * sans connaître la technologie sous-jacente (MySQL, etc.). L'implémentation vit dans
 * l'infrastructure et est injectée au use case.
 */
export interface IUserRepository {
  /**
   * Recherche un utilisateur par son adresse e-mail.
   *
   * @param email - L'e-mail (value object) recherché.
   * @returns Le `User` correspondant, ou `null` s'il n'existe pas.
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Indique si un compte existe déjà pour une adresse e-mail donnée.
   *
   * @param email - L'e-mail (value object) à tester.
   * @returns `true` si un utilisateur existe avec cet e-mail, `false` sinon.
   */
  existsByEmail(email: Email): Promise<boolean>;

  /**
   * Persiste un nouvel utilisateur.
   *
   * @param user - L'entité `User` à enregistrer.
   * @returns Une promesse résolue une fois l'utilisateur enregistré.
   */
  save(user: User): Promise<void>;
}
