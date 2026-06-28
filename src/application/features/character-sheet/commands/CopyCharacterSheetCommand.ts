/**
 * Commande du use case « copier une fiche vers une autre campagne ».
 *
 * Remplace l'ancien « rattacher une même fiche à plusieurs campagnes » (modèle N‑N abandonné) :
 * on duplique tous les champs/stats de la fiche source vers une **nouvelle fiche** (nouvel id),
 * rattachée à `targetCampaignId` en statut PENDING. `actorUserId` provient de la session.
 */
export interface CopyCharacterSheetCommand {
  /** Identifiant de la fiche source à copier (l'acteur doit en être propriétaire). */
  readonly sourceSheetId: string;
  /** Identifiant de la campagne cible de la copie (même groupe, l'acteur n'en est pas le MJ). */
  readonly targetCampaignId: string;
  /** Identifiant du demandeur (issu de la session authentifiée). */
  readonly actorUserId: string;
}
