import { Campaign } from "@domain/features/campaign/entities/Campaign";

/**
 * Port « out » d'accès aux campagnes.
 *
 * La couche application dépend de cette interface ; l'implémentation concrète (MySQL)
 * vit dans l'infrastructure. Une table = un repository.
 */
export interface CampaignRepository {
  /**
   * Persiste une campagne (création).
   *
   * @param campaign - L'entité à enregistrer.
   */
  save(campaign: Campaign): Promise<void>;

  /**
   * Récupère toutes les campagnes dont l'utilisateur donné est le maître du jeu.
   *
   * @param gameMasterId - Identifiant du MJ propriétaire.
   * @returns La liste de ses campagnes (vide si aucune).
   */
  findByGameMasterId(gameMasterId: string): Promise<Campaign[]>;

  /**
   * Récupère une campagne par son identifiant.
   *
   * @param id - L'identifiant de la campagne.
   * @returns La campagne, ou `null` si aucune ne correspond.
   */
  findById(id: string): Promise<Campaign | null>;

  /**
   * Supprime une campagne par son identifiant (idempotent : aucune erreur si absente).
   *
   * @param id - L'identifiant de la campagne à supprimer.
   */
  deleteById(id: string): Promise<void>;
}
