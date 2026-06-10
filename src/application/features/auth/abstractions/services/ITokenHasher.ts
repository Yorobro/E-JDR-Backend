/**
 * Port de hachage **déterministe** d'un jeton (port « out »).
 *
 * Sert à calculer l'empreinte stockée/recherchée d'un refresh token. Contrairement au
 * hachage de mot de passe (lent, salé, non déterministe), on a besoin ici d'un hachage
 * **déterministe** (même entrée → même empreinte) pour pouvoir retrouver un token par son
 * empreinte. Un SHA-256 convient, le refresh token étant déjà à forte entropie.
 *
 * L'implémentation concrète vit dans l'infrastructure.
 */
export interface ITokenHasher {
  /**
   * Calcule l'empreinte déterministe d'un jeton.
   *
   * @param token - Le jeton brut.
   * @returns L'empreinte (hexadécimale) du jeton.
   */
  hash(token: string): string;
}


