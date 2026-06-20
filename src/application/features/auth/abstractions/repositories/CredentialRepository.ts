import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";

/**
 * Port de persistance des identifiants d'authentification (port « out »).
 *
 * Sépare le stockage des données d'auth (e-mail + empreinte du mot de passe) de celui de
 * l'identité métier (`UserRepository`). L'implémentation concrète (MySQL) vit dans
 * l'infrastructure et est injectée aux use cases.
 */
export interface CredentialRepository {
  /**
   * Recherche un identifiant par son adresse e-mail.
   *
   * @param email - L'e-mail (value object) recherché.
   * @returns Le `Credential` correspondant, ou `null` s'il n'existe pas.
   */
  findByEmail(email: Email): Promise<Credential | null>;

  /**
   * Recherche un identifiant d'authentification par l'utilisateur auquel il est rattaché.
   *
   * @param userId - L'identifiant de l'utilisateur (relation 1–1 avec `Credential`).
   * @returns Le `Credential` correspondant, ou `null` s'il n'existe pas.
   */
  findByUserId(userId: string): Promise<Credential | null>;

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
   */
  save(credential: Credential): Promise<void>;

  /**
   * Met à jour un identifiant existant (ex : compteur de tentatives, verrouillage).
   *
   * @param credential - L'entité `Credential` dont l'état doit être persisté.
   */
  update(credential: Credential): Promise<void>;

  /**
   * Met à jour l'adresse e-mail d'un identifiant existant.
   *
   * @param credential - L'entité `Credential` portant le nouvel e-mail.
   */
  updateEmail(credential: Credential): Promise<void>;

  /**
   * Met à jour le mot de passe haché d'un identifiant existant.
   *
   * @param credential - L'entité `Credential` portant le nouveau mot de passe haché.
   */
  updatePassword(credential: Credential): Promise<void>;
}
