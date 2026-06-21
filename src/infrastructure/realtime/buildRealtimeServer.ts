import http from "node:http";
import { Application } from "express";

import { TokenProviderService } from "@application/features/auth/abstractions/services/TokenProviderService";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { SheetGroupLookup } from "@application/features/realtime/abstractions/SheetGroupLookup";
import { RealtimeHub } from "@infrastructure/realtime/RealtimeHub";
import {
  attachWebSocketServer,
  RealtimeChannelAuthorizer,
} from "@infrastructure/realtime/WebSocketServer";

/**
 * Crée le serveur HTTP et y greffe le serveur WebSocket de la fondation temps réel (`/ws`).
 *
 * Extrait du composition root (`main.ts`) pour isoler le câblage temps réel. L'autorisateur de
 * canaux est construit ici ; l'auth du handshake WS réutilise le `TokenProviderService` du REST.
 * Le bus pub/sub `hub` est fourni par l'appelant car il est **partagé** avec le
 * `WsRealtimeNotifier` (qui publie depuis les use cases) : publication et diffusion doivent
 * passer par la même instance.
 *
 * @param app - L'application Express déjà assemblée.
 * @param tokenProvider - Vérificateur de jetons (auth du handshake WS, identique au REST).
 * @param groupAccessService - Service d'accès aux groupes (autorise les abonnements `group:`).
 * @param hub - Le bus pub/sub partagé avec le notifier.
 * @param sheetGroupLookup - Résout le groupe d'une fiche pour autoriser les abonnements `sheet:`.
 * @returns Le serveur HTTP portant l'app Express ET le serveur WebSocket.
 */
export function buildRealtimeServer(
  app: Application,
  tokenProvider: TokenProviderService,
  groupAccessService: GroupAccessService,
  hub: RealtimeHub,
  sheetGroupLookup: SheetGroupLookup,
): http.Server {
  const authorizer = new RealtimeChannelAuthorizer({
    groupAccess: groupAccessService,
    sheetGroupLookup,
  });

  const httpServer = http.createServer(app);
  attachWebSocketServer(httpServer, { hub, tokenProvider, authorizer });
  return httpServer;
}
