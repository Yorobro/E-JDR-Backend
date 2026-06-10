/**
 * Classe de base abstraite de toutes les erreurs du **domaine**.
 *
 * Une `DomainError` représente la violation d'une règle métier ou d'un invariant
 * (ex : un e-mail mal formé, un mot de passe trop faible). Elle est volontairement
 * indépendante de toute technologie (HTTP, BDD...) : le domaine ne connaît que le métier.
 *
 * Chaque erreur concrète du domaine doit hériter de cette classe et fournir un `code`
 * stable, utilisable par les couches externes pour la traduction (ex : code HTTP).
 */
export abstract class DomainError extends Error {
  /**
   * Code symbolique et stable identifiant le type d'erreur (ex : `"INVALID_EMAIL"`).
   * Contrairement au message, il n'est pas destiné à l'affichage mais au routage/log.
   */
  public readonly code: string;

  /**
   * Construit une erreur de domaine.
   *
   * @param code - Identifiant symbolique stable de l'erreur.
   * @param message - Message lisible décrivant la violation métier.
   */
  protected constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;

    // Restaure la chaîne de prototypes (nécessaire en TS lorsqu'on étend Error).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

