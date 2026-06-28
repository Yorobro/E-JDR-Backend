import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";

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
   * Récupère les fiches rattachées à une campagne ayant un statut donné (PENDING ou ACCEPTED).
   *
   * - ACCEPTED : les personnages réellement présents dans la campagne.
   * - PENDING : les demandes de rattachement en attente de validation du MJ.
   *
   * @param campaignId - Identifiant de la campagne.
   * @param status - Statut de rattachement recherché (`"PENDING"` ou `"ACCEPTED"`).
   * @returns Les fiches correspondantes (tableau éventuellement vide).
   */
  findByCampaignIdAndStatus(campaignId: string, status: string): Promise<CharacterSheet[]>;

  /**
   * Met à jour le seul statut de rattachement d'une fiche (validation MJ : PENDING → ACCEPTED).
   *
   * @param id - Identifiant de la fiche.
   * @param status - Nouveau statut (`"PENDING"` ou `"ACCEPTED"`).
   */
  updateLinkStatus(id: string, status: string): Promise<void>;

  /**
   * Vue de la campagne **unique** à laquelle la fiche est rattachée (nom + pseudo du MJ + statut),
   * ou `null` si la fiche n'existe pas (modèle « une fiche = une campagne »).
   *
   * @param sheetId - Identifiant de la fiche.
   * @returns La vue de campagne, ou `null`.
   */
  findCampaignViewBySheetId(sheetId: string): Promise<SheetCampaignView | null>;
}
