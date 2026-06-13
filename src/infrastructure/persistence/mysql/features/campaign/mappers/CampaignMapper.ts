import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";
import { CampaignRow } from "@infrastructure/persistence/mysql/features/campaign/dao/CampaignDao";

/**
 * Traduit entre la représentation **persistance** (`CampaignRow`) et l'**entité domaine**
 * (`Campaign`).
 *
 * C'est l'une des frontières où le value object `CampaignName` traverse la limite du cœur :
 * en lecture, le nom stocké (réputé déjà valide) est ré-encapsulé dans un `CampaignName` ; en
 * écriture, le VO est déballé vers une chaîne brute pour la colonne `name`. Mapper sans état.
 */
export class CampaignMapper {
  /**
   * Convertit une ligne SQL brute en entité domaine `Campaign`.
   *
   * @param row - La ligne `campaigns` issue de la base.
   * @returns L'entité `Campaign` reconstruite.
   */
  public static toDomain(row: CampaignRow): Campaign {
    return Campaign.restore({
      id: row.id,
      gameMasterId: row.game_master_id,
      name: CampaignName.create(row.name),
      createdAt: new Date(row.created_at),
    });
  }

  /**
   * Convertit une entité domaine `Campaign` en valeurs de colonnes prêtes pour l'insertion.
   *
   * @param campaign - L'entité `Campaign` à persister.
   * @returns Un objet dont les clés correspondent aux colonnes de la table `campaigns`.
   */
  public static toRow(campaign: Campaign): {
    id: string;
    game_master_id: string;
    name: string;
    created_at: Date;
  } {
    return {
      id: campaign.id,
      game_master_id: campaign.gameMasterId,
      name: campaign.name.value,
      created_at: campaign.createdAt,
    };
  }
}
