import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";

/**
 * Port « out » de la liaison N-N entre campagnes et fiches de personnage
 * (table `campaign_characters`).
 *
 * Gère le rattachement d'une fiche à une campagne, son détachement, et la lecture des fiches
 * rattachées à une campagne. Implémenté par l'infrastructure (MySQL).
 */
export interface CampaignCharacterRepository {
  /**
   * Rattache une fiche à une campagne.
   *
   * @param campaignId - Identifiant de la campagne.
   * @param characterSheetId - Identifiant de la fiche.
   * @param createdAt - Horodatage du rattachement.
   */
  link(campaignId: string, characterSheetId: string, createdAt: Date): Promise<void>;

  /**
   * Détache une fiche d'une campagne (idempotent : aucune erreur si le lien n'existe pas).
   *
   * @param campaignId - Identifiant de la campagne.
   * @param characterSheetId - Identifiant de la fiche.
   */
  unlink(campaignId: string, characterSheetId: string): Promise<void>;

  /**
   * Indique si une fiche est déjà rattachée à une campagne.
   *
   * @param campaignId - Identifiant de la campagne.
   * @param characterSheetId - Identifiant de la fiche.
   * @returns `true` si le lien existe déjà.
   */
  existsByCampaignAndSheet(campaignId: string, characterSheetId: string): Promise<boolean>;

  /**
   * Récupère les fiches rattachées à une campagne.
   *
   * @param campaignId - Identifiant de la campagne.
   * @returns Les fiches rattachées (vide si aucune).
   */
  findSheetsByCampaignId(campaignId: string): Promise<CharacterSheet[]>;

  /**
   * Récupère les campagnes auxquelles une fiche est rattachée, avec le pseudo du MJ.
   * @param characterSheetId - Identifiant de la fiche.
   * @returns Les vues (vide si aucune), des plus récemment rattachées aux plus anciennes.
   */
  findCampaignViewsBySheetId(characterSheetId: string): Promise<SheetCampaignView[]>;
}
