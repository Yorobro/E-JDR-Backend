/**
 * Abstraction minimale d'une connexion temps réel : tout ce dont le hub a besoin pour
 * pousser un message. Satisfaite par un `WebSocket` (méthode `send`) et par un fake de test.
 */
export interface RealtimeClient {
  send(data: string): void;
}

/**
 * Bus pub/sub en mémoire : associe des canaux à des ensembles de connexions et diffuse les
 * messages. Sans dépendance à `ws`, donc testable avec de simples doublures.
 */
export class RealtimeHub {
  /** Canal → ensemble des clients abonnés. */
  private readonly channels = new Map<string, Set<RealtimeClient>>();

  /** Abonne un client à un canal (idempotent). */
  public subscribe(client: RealtimeClient, channel: string): void {
    let clients = this.channels.get(channel);
    if (clients === undefined) {
      clients = new Set<RealtimeClient>();
      this.channels.set(channel, clients);
    }
    clients.add(client);
  }

  /** Désabonne un client d'un canal ; supprime le canal s'il devient vide. */
  public unsubscribe(client: RealtimeClient, channel: string): void {
    const clients = this.channels.get(channel);
    if (clients === undefined) {
      return;
    }
    clients.delete(client);
    if (clients.size === 0) {
      this.channels.delete(channel);
    }
  }

  /** Retire un client de tous les canaux (à la déconnexion). */
  public removeClient(client: RealtimeClient): void {
    for (const [channel, clients] of this.channels.entries()) {
      clients.delete(client);
      if (clients.size === 0) {
        this.channels.delete(channel);
      }
    }
  }

  /** Diffuse un message (sérialisé en JSON) à tous les clients abonnés au canal. */
  public publish(channel: string, payload: object): void {
    const clients = this.channels.get(channel);
    if (clients === undefined) {
      return;
    }
    const data = JSON.stringify(payload);
    for (const client of clients) {
      client.send(data);
    }
  }

  /** Nombre de clients abonnés à un canal (utilitaire de test/diagnostic). */
  public subscriberCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }
}
