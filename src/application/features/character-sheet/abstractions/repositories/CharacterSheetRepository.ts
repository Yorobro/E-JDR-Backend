import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";

/**
 * Port « out » d'accès aux fiches de personnage.
 *
 * La couche application dépend de cette interface ; l'implémentation concrète (MySQL) vit
 * dans l'infrastructure. Une table = un repository.
 */
export interface CharacterSheetRepository {
  /**
   * Persiste une fiche (création).
   *
   * @param sheet - L'entité à enregistrer.
   */
  save(sheet: CharacterSheet): Promise<void>;

  /**
   * Récupère toutes les fiches appartenant à un utilisateur.
   *
   * @param ownerId - Identifiant du propriétaire.
   * @returns Ses fiches (vide si aucune).
   */
  findByOwnerId(ownerId: string): Promise<CharacterSheet[]>;

  /**
   * Récupère une fiche par son identifiant.
   *
   * @param id - L'identifiant de la fiche.
   * @returns La fiche, ou `null` si aucune ne correspond.
   */
  findById(id: string): Promise<CharacterSheet | null>;

  /**
   * Supprime une fiche par son identifiant (idempotent : aucune erreur si absente).
   *
   * @param id - L'identifiant de la fiche à supprimer.
   */
  deleteById(id: string): Promise<void>;
}
