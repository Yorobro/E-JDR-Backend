import { User } from "@domain/features/auth/entities/User";

/**
 * Port de persistance des utilisateurs métier (port « out »).
 *
 * Ne gère que l'identité applicative (`User`) ; les données d'authentification (e-mail,
 * mot de passe) relèvent d'`ICredentialRepository`. L'implémentation vit dans l'infrastructure
 * et est injectée au use case.
 */
export interface IUserRepository {
  /**
   * Recherche un utilisateur par son identifiant.
   *
   * @param id - L'identifiant de l'utilisateur recherché.
   * @returns Le `User` correspondant, ou `null` s'il n'existe pas.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Persiste un nouvel utilisateur.
   *
   * @param user - L'entité `User` à enregistrer.
   * @returns Une promesse résolue une fois l'utilisateur enregistré.
   */
  save(user: User): Promise<void>;
}


