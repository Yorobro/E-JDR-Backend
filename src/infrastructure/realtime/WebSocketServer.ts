import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { TokenProviderService } from "@application/features/auth/abstractions/services/TokenProviderService";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { ACCESS_TOKEN_COOKIE } from "@presentation/http/features/auth/mappers/AuthHttpMapper";
import { RealtimeHub } from "@infrastructure/realtime/RealtimeHub";
import { userChannel, parseChannel } from "@infrastructure/realtime/RealtimeChannels";
import { parseCookies } from "@infrastructure/realtime/parseCookies";
import { SheetGroupLookup } from "@application/features/realtime/abstractions/SheetGroupLookup";

/** Décide si un utilisateur a le droit de s'abonner à un canal donné. */
export interface ChannelAuthorizer {
  canSubscribe(userId: string, channel: string): Promise<boolean>;
}

/** Dépendances de l'autorisateur de canaux. */
export interface ChannelAuthorizerDeps {
  groupAccess: Pick<GroupAccessService, "requireMember">;
  sheetGroupLookup: SheetGroupLookup;
}

/**
 * Autorise les abonnements selon le type de canal :
 * - `user:{id}` : seulement si `id` est l'utilisateur lui-même ;
 * - `group:{id}` : seulement si l'utilisateur est membre du groupe ;
 * - `sheet:{id}` : refusé par défaut à ce stade (affiné au Lot 3 avec le repo de fiches).
 */
export class RealtimeChannelAuthorizer implements ChannelAuthorizer {
  constructor(private readonly deps: ChannelAuthorizerDeps) {}

  public async canSubscribe(userId: string, channel: string): Promise<boolean> {
    const parsed = parseChannel(channel);
    if (parsed === null) {
      return false;
    }
    if (parsed.kind === "user") {
      return parsed.id === userId;
    }
    if (parsed.kind === "group") {
      const result = await this.deps.groupAccess.requireMember(userId, parsed.id);
      return result.isSuccess;
    }
    if (parsed.kind === "sheet") {
      const groupId = await this.deps.sheetGroupLookup.groupIdOf(parsed.id);
      if (groupId === null) {
        return false;
      }
      const result = await this.deps.groupAccess.requireMember(userId, groupId);
      return result.isSuccess;
    }
    return false;
  }
}

/** Dépendances du serveur WebSocket. */
export interface WebSocketServerDeps {
  hub: RealtimeHub;
  tokenProvider: TokenProviderService;
  authorizer: ChannelAuthorizer;
}

/**
 * Attache un serveur WebSocket au serveur HTTP existant sur le chemin `/ws`.
 *
 * Auth au handshake : lit le cookie `access_token`, le vérifie ; si invalide/absent, la
 * connexion est fermée immédiatement (code 4401). Sinon, le client est abonné automatiquement
 * à `user:{userId}` et peut envoyer des messages `subscribe`/`unsubscribe` (autorisés par
 * `authorizer`). À la fermeture, le client est retiré de tous ses canaux.
 */
export function attachWebSocketServer(httpServer: http.Server, deps: WebSocketServerDeps): void {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket: WebSocket, request: http.IncomingMessage) => {
    const cookies = parseCookies(request.headers.cookie);
    const token = cookies[ACCESS_TOKEN_COOKIE];
    const payload = token === undefined ? null : deps.tokenProvider.verifyAccessToken(token);

    if (payload === null) {
      socket.close(4401, "Authentification requise");
      return;
    }

    const userId = payload.userId;
    deps.hub.subscribe(socket, userChannel(userId));

    socket.on("message", (raw) => {
      void handleMessage(raw.toString(), userId, socket, deps);
    });

    socket.on("close", () => {
      deps.hub.removeClient(socket);
    });
  });
}

/** Traite un message client `subscribe`/`unsubscribe` après vérification d'autorisation. */
async function handleMessage(
  raw: string,
  userId: string,
  socket: WebSocket,
  deps: WebSocketServerDeps,
): Promise<void> {
  let message: { type?: string; channel?: string };
  try {
    message = JSON.parse(raw) as { type?: string; channel?: string };
  } catch {
    return;
  }
  const channel = message.channel;
  if (typeof channel !== "string") {
    return;
  }
  if (message.type === "subscribe") {
    const allowed = await deps.authorizer.canSubscribe(userId, channel);
    if (allowed) {
      deps.hub.subscribe(socket, channel);
      socket.send(JSON.stringify({ type: "subscribed", channel }));
    } else {
      socket.send(JSON.stringify({ type: "error", channel, message: "Abonnement refusé" }));
    }
  } else if (message.type === "unsubscribe") {
    deps.hub.unsubscribe(socket, channel);
  }
}
