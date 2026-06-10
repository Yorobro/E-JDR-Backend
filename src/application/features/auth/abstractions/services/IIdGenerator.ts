/**
 * Port de génération d'identifiants uniques (port « out »).
 *
 * Abstrait la stratégie de génération (UUID v4, ULID...) afin que la couche application
 * ne dépende pas d'une implémentation concrète. Utile aussi pour les tests (générateur
 * déterministe). L'implémentation réelle vit dans l'infrastructure.
 */
export interface IIdGenerator {
  /**
   * Génère un nouvel identifiant unique.
   *
   * @returns L'identifiant généré, sous forme de chaîne.
   */
  generate(): string;
}

