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
   * Met à jour une fiche existante (nom + champs détaillés). N'altère ni le propriétaire ni la
   * date de création.
   *
   * @param sheet - L'entité dans son nouvel état.
   */
  update(sheet: CharacterSheet): Promise<void>;

  /**
   * Récupère toutes les fiches appartenant à un utilisateur.
   *
   * @param ownerId - Identifiant du propriétaire.
   * @returns Ses fiches (vide si aucune).
   */
  findByOwnerId(ownerId: string): Promise<CharacterSheet[]>;

  /**
   * Récupère toutes les fiches d'un groupe (visibilité « tout le groupe », D3/D10).
   *
   * @param groupId - Identifiant du groupe.
   * @returns Les fiches du groupe (vide si aucune).
   */
  findByGroupId(groupId: string): Promise<CharacterSheet[]>;

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

  /**
   * Récupère les fiches rattachables à une campagne : toutes les fiches **du groupe de la
   * campagne** dont le propriétaire n'est PAS le maître du jeu, en excluant les fiches déjà
   * rattachées à cette campagne (D6 : le MJ pioche parmi toutes les fiches du groupe).
   *
   * @param groupId - Identifiant du groupe de la campagne (limite la liste à ce groupe).
   * @param gameMasterId - Identifiant du MJ de la campagne (ses fiches sont exclues).
   * @param campaignId - Identifiant de la campagne (les fiches déjà liées sont exclues).
   * @returns Les fiches rattachables (tableau éventuellement vide).
   */
  findLinkableForCampaign(
    groupId: string,
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheet[]>;
}
