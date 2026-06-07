import { Credential } from "@domain/auth/entities/Credential";
import { Email } from "@domain/auth/value-objects/Email";

/**
 * Port de persistance des identifiants d'authentification (port « out »).
 *
 * Sépare le stockage des données d'auth (e-mail + empreinte du mot de passe) de celui de
 * l'identité métier (`IUserRepository`). L'implémentation concrète (MySQL) vit dans
 * l'infrastructure et est injectée aux use cases.
 */
export interface ICredentialRepository {
  /**
   * Recherche un identifiant par son adresse e-mail.
   *
   * @param email - L'e-mail (value object) recherché.
   * @returns Le `Credential` correspondant, ou `null` s'il n'existe pas.
   */
  findByEmail(email: Email): Promise<Credential | null>;

  /**
   * Indique si un identifiant existe déjà pour une adresse e-mail donnée.
   *
   * @param email - L'e-mail (value object) à tester.
   * @returns `true` si un identifiant existe avec cet e-mail, `false` sinon.
   */
  existsByEmail(email: Email): Promise<boolean>;

  /**
   * Persiste un nouvel identifiant d'authentification.
   *
   * @param credential - L'entité `Credential` à enregistrer.
   * @returns Une promesse résolue une fois l'identifiant enregistré.
   */
  save(credential: Credential): Promise<void>;
}
