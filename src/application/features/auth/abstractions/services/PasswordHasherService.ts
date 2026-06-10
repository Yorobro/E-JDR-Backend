/**
 * Port de hachage des mots de passe (port « out »).
 *
 * Abstrait l'algorithme de hachage (bcrypt, argon2...) afin que la couche application
 * et le domaine n'en dépendent pas. L'implémentation concrète vit dans l'infrastructure.
 */
export interface PasswordHasherService {
  /**
   * Hache un mot de passe en clair.
   *
   * @param plainPassword - Le mot de passe en clair à hacher.
   * @returns L'empreinte (hash) du mot de passe.
   */
  hash(plainPassword: string): Promise<string>;

  /**
   * Compare un mot de passe en clair à une empreinte existante.
   *
   * @param plainPassword - Le mot de passe en clair à vérifier.
   * @param hash - L'empreinte de référence.
   * @returns `true` si le mot de passe correspond à l'empreinte, `false` sinon.
   */
  compare(plainPassword: string, hash: string): Promise<boolean>;
}
