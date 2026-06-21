import http from "node:http";
import { Application } from "express";

import { TokenProviderService } from "@application/features/auth/abstractions/services/TokenProviderService";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { RealtimeHub } from "@infrastructure/realtime/RealtimeHub";
import {
  attachWebSocketServer,
  RealtimeChannelAuthorizer,
} from "@infrastructure/realtime/WebSocketServer";

/**
 * Crée le serveur HTTP et y greffe le serveur WebSocket de la fondation temps réel (`/ws`).
 *
 * Extrait du composition root (`main.ts`) pour isoler le câblage temps réel. Le bus pub/sub
 * `RealtimeHub` et l'autorisateur de canaux sont construits ici ; l'auth du handshake WS
 * réutilise le `TokenProviderService` du REST. Le `WsRealtimeNotifier` (publication d'events
 * depuis les use cases) sera câblé au lot « feature pilote » (Lot 3), où il sera injecté dans
 * les use cases concernés.
 *
 * @param app - L'application Express déjà assemblée.
 * @param tokenProvider - Vérificateur de jetons (auth du handshake WS, identique au REST).
 * @param groupAccessService - Service d'accès aux groupes (autorise les abonnements `group:`).
 * @returns Le serveur HTTP portant l'app Express ET le serveur WebSocket.
 */
export function buildRealtimeServer(
  app: Application,
  tokenProvider: TokenProviderService,
  groupAccessService: GroupAccessService,
): http.Server {
  const hub = new RealtimeHub();
  const authorizer = new RealtimeChannelAuthorizer({ groupAccess: groupAccessService });

  const httpServer = http.createServer(app);
  attachWebSocketServer(httpServer, { hub, tokenProvider, authorizer });
  return httpServer;
}
