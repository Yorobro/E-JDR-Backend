import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { Logger } from "@application/shared/Logger";
import { RealtimeHub } from "@infrastructure/realtime/RealtimeHub";
import { userChannel, groupChannel, sheetChannel } from "@infrastructure/realtime/RealtimeChannels";

/**
 * Implémentation WebSocket du port {@link RealtimeNotifier}.
 *
 * Traduit chaque `notify*` en une publication d'event d'invalidation sur le canal adéquat.
 * **Best-effort** : toute erreur de publication est journalisée puis avalée, afin que l'échec
 * du temps réel n'impacte jamais l'opération métier appelante.
 */
export class WsRealtimeNotifier implements RealtimeNotifier {
  constructor(
    private readonly hub: RealtimeHub,
    private readonly logger: Logger,
  ) {}

  public notifyUserChanged(userId: string, resource: string): void {
    this.publish(userChannel(userId), resource, userId);
  }

  public notifyGroupChanged(groupId: string, resource: string): void {
    this.publish(groupChannel(groupId), resource, groupId);
  }

  public notifySheetChanged(sheetId: string, resource: string): void {
    this.publish(sheetChannel(sheetId), resource, sheetId);
  }

  /** Publie un event `invalidate` sur un canal, en avalant toute erreur (best-effort). */
  private publish(channel: string, resource: string, scopeId: string): void {
    try {
      this.hub.publish(channel, { type: "invalidate", channel, resource, scopeId });
    } catch {
      this.logger.warn("Échec de publication temps réel (ignoré)", { channel, resource });
    }
  }
}
