/**
 * Port « out » de notification temps réel (couche application).
 *
 * Un use case appelle ces méthodes APRÈS une écriture réussie pour signaler qu'un périmètre
 * a changé. L'implémentation (infrastructure) traduit ça en diffusion WebSocket. Best-effort :
 * ces méthodes ne renvoient rien et ne lèvent jamais — le temps réel ne casse pas le métier.
 */
export interface RealtimeNotifier {
  /** Signale un changement aux appareils d'un utilisateur (canal `user:{userId}`). */
  notifyUserChanged(userId: string, resource: string): void;
  /** Signale un changement aux membres d'un groupe (canal `group:{groupId}`). */
  notifyGroupChanged(groupId: string, resource: string): void;
  /** Signale un changement à ceux qui regardent une fiche (canal `sheet:{sheetId}`). */
  notifySheetChanged(sheetId: string, resource: string): void;
}
