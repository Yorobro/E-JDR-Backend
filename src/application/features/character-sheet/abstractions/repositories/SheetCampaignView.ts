/**
 * Vue de lecture plate (read model) d'une campagne à laquelle une fiche est rattachée, enrichie du
 * pseudo de son maître du jeu. Projection cross-agrégat (campaigns + users) : volontairement PAS
 * une entité domaine `Campaign` (qui ne porte pas le pseudo du MJ).
 */
export interface SheetCampaignView {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly gameMasterPseudo: string;
}
