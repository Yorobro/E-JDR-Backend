# Temps réel — Fondation backend (Lots 0+1) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la fondation temps réel côté backend : un serveur WebSocket authentifié par cookie JWT, un hub pub/sub par canaux, et un port `RealtimeNotifier` que les use cases appelleront pour diffuser des invalidations.

**Architecture:** Serveur `ws` attaché au `http.Server` Express existant sur le chemin `/ws`. Auth au handshake via le cookie `access_token` (réutilise `TokenProviderService.verifyAccessToken`). Un `RealtimeHub` en mémoire mappe `canal → connexions` et expose `subscribe/unsubscribe/publish`. Port `RealtimeNotifier` (application) + impl `WsRealtimeNotifier` (infra). Best-effort : aucune erreur temps réel ne remonte dans un use case.

**Tech Stack:** Node 22 / TypeScript, Express, lib `ws`, JWT (jsonwebtoken via `TokenProviderService`), Vitest. Architecture hexagonale existante (domain/application/infrastructure/presentation), alias `@application/@infrastructure/@presentation/@config`.

## Global Constraints

- Architecture hexagonale stricte : un use case n'appelle jamais un autre use case ; les ports sont des interfaces (préfixe `I` non utilisé ici, on suit le nommage existant `RealtimeNotifier`) sous `abstractions/`.
- `Result<T,E>` pour les erreurs métier ; exceptions réservées au technique. Le temps réel est **best-effort** : `WsRealtimeNotifier` avale ses erreurs (try/catch + log), ne renvoie jamais d'échec.
- L'auth WS lit le cookie `access_token` (constante `ACCESS_TOKEN_COOKIE` de `@presentation/http/features/auth/mappers/AuthHttpMapper`) et le vérifie via `TokenProviderService.verifyAccessToken(token): TokenPayload | null`. Le `userId` vient TOUJOURS du JWT, jamais d'un message client.
- Lint zéro-warning (ESLint), Prettier, TypeScript strict. `npm run lint && npm run test && npm run build` doivent rester verts.
- Dev sur branche `feat/realtime-invalidation` (déjà créée depuis `develop`). Commits fréquents, Conventional Commits (hook commitlint actif).
- Canaux : `user:{userId}` (auto, permanent), `group:{groupId}`, `sheet:{sheetId}`. Format d'event : `{ type: "invalidate", channel, resource, scopeId }`.

---

## File Structure

- `src/application/features/realtime/abstractions/RealtimeNotifier.ts` — port (interface) : `notifyUserChanged`, `notifyGroupChanged`, `notifySheetChanged`.
- `src/infrastructure/realtime/RealtimeHub.ts` — pub/sub en mémoire (canal → Set de connexions), `subscribe/unsubscribe/publish/removeConnection`. Indépendant de `ws` (travaille sur une interface `RealtimeClient` minimale = `{ send(data: string): void }`), donc testable sans vrai socket.
- `src/infrastructure/realtime/WsRealtimeNotifier.ts` — impl du port : traduit `notify*` en `hub.publish(canal, event)`, best-effort.
- `src/infrastructure/realtime/RealtimeChannels.ts` — fabriques de noms de canaux (`userChannel(id)`, `groupChannel(id)`, `sheetChannel(id)`) pour éviter les chaînes magiques dupliquées.
- `src/infrastructure/realtime/WebSocketServer.ts` — attache `ws` au `http.Server`, auth au handshake, abonnement auto `user:{id}`, gestion des messages `subscribe`/`unsubscribe` avec autorisation, nettoyage à la déconnexion.
- `src/infrastructure/realtime/parseCookies.ts` — parse l'en-tête `Cookie` brut (le handshake WS n'a pas `cookieParser`).
- `tests/infrastructure/realtime/RealtimeHub.test.ts`, `RealtimeChannels.test.ts`, `WsRealtimeNotifier.test.ts`, `parseCookies.test.ts` — tests unitaires.
- Modifs : `src/main.ts` (créer le `http.Server`, attacher le WS, injecter le notifier), et plus tard les use cases (Lot 3, hors de ce plan).

---

### Task 1: Fabriques de noms de canaux

**Files:**
- Create: `src/infrastructure/realtime/RealtimeChannels.ts`
- Test: `tests/infrastructure/realtime/RealtimeChannels.test.ts`

**Interfaces:**
- Produces: `userChannel(userId: string): string` → `"user:{userId}"` ; `groupChannel(groupId: string): string` → `"group:{groupId}"` ; `sheetChannel(sheetId: string): string` → `"sheet:{sheetId}"` ; `parseChannel(channel: string): { kind: "user" | "group" | "sheet"; id: string } | null`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/infrastructure/realtime/RealtimeChannels.test.ts
import { describe, it, expect } from "vitest";
import {
  userChannel,
  groupChannel,
  sheetChannel,
  parseChannel,
} from "@infrastructure/realtime/RealtimeChannels";

describe("RealtimeChannels", () => {
  it("construit les noms de canaux préfixés par type", () => {
    expect(userChannel("u1")).toBe("user:u1");
    expect(groupChannel("g1")).toBe("group:g1");
    expect(sheetChannel("s1")).toBe("sheet:s1");
  });

  it("parse un canal valide en {kind, id}", () => {
    expect(parseChannel("group:42")).toEqual({ kind: "group", id: "42" });
    expect(parseChannel("user:abc")).toEqual({ kind: "user", id: "abc" });
    expect(parseChannel("sheet:99")).toEqual({ kind: "sheet", id: "99" });
  });

  it("renvoie null pour un canal de type inconnu ou malformé", () => {
    expect(parseChannel("admin:1")).toBeNull();
    expect(parseChannel("group:")).toBeNull();
    expect(parseChannel("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/realtime/RealtimeChannels.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/infrastructure/realtime/RealtimeChannels.ts
/** Type de canal temps réel reconnu. */
export type ChannelKind = "user" | "group" | "sheet";

/** Canal des événements personnels d'un utilisateur (abonnement automatique). */
export function userChannel(userId: string): string {
  return `user:${userId}`;
}

/** Canal des événements d'un groupe (membres du groupe). */
export function groupChannel(groupId: string): string {
  return `group:${groupId}`;
}

/** Canal des événements d'une fiche ouverte (abonnement éphémère). */
export function sheetChannel(sheetId: string): string {
  return `sheet:${sheetId}`;
}

/**
 * Décompose un nom de canal en `{ kind, id }`, ou renvoie `null` si le type est inconnu
 * ou l'identifiant absent.
 */
export function parseChannel(channel: string): { kind: ChannelKind; id: string } | null {
  const separator = channel.indexOf(":");
  if (separator <= 0) {
    return null;
  }
  const prefix = channel.slice(0, separator);
  const id = channel.slice(separator + 1);
  if (id === "") {
    return null;
  }
  if (prefix === "user" || prefix === "group" || prefix === "sheet") {
    return { kind: prefix, id };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/realtime/RealtimeChannels.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/realtime/RealtimeChannels.ts tests/infrastructure/realtime/RealtimeChannels.test.ts
git commit -m "feat(realtime): fabriques et parsing des noms de canaux"
```

---

### Task 2: RealtimeHub (pub/sub en mémoire)

**Files:**
- Create: `src/infrastructure/realtime/RealtimeHub.ts`
- Test: `tests/infrastructure/realtime/RealtimeHub.test.ts`

**Interfaces:**
- Consumes: rien (autonome).
- Produces:
  - `interface RealtimeClient { send(data: string): void }` (abstraction minimale d'une connexion, satisfaite par un `WebSocket` réel).
  - `class RealtimeHub` avec : `subscribe(client: RealtimeClient, channel: string): void` ; `unsubscribe(client: RealtimeClient, channel: string): void` ; `removeClient(client: RealtimeClient): void` (retire le client de tous ses canaux) ; `publish(channel: string, payload: object): void` (envoie `JSON.stringify(payload)` à chaque client abonné) ; `subscriberCount(channel: string): number` (pour les tests).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/infrastructure/realtime/RealtimeHub.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeHub, RealtimeClient } from "@infrastructure/realtime/RealtimeHub";

class FakeClient implements RealtimeClient {
  public readonly sent: string[] = [];
  public send(data: string): void {
    this.sent.push(data);
  }
}

describe("RealtimeHub", () => {
  let hub: RealtimeHub;
  beforeEach(() => {
    hub = new RealtimeHub();
  });

  it("diffuse un message à tous les clients abonnés au canal", () => {
    const a = new FakeClient();
    const b = new FakeClient();
    hub.subscribe(a, "group:1");
    hub.subscribe(b, "group:1");

    hub.publish("group:1", { type: "invalidate", channel: "group:1" });

    const expected = JSON.stringify({ type: "invalidate", channel: "group:1" });
    expect(a.sent).toEqual([expected]);
    expect(b.sent).toEqual([expected]);
  });

  it("n'envoie rien aux clients non abonnés au canal", () => {
    const a = new FakeClient();
    hub.subscribe(a, "group:1");

    hub.publish("group:2", { x: 1 });

    expect(a.sent).toEqual([]);
  });

  it("ne dédouble pas un client abonné deux fois au même canal", () => {
    const a = new FakeClient();
    hub.subscribe(a, "group:1");
    hub.subscribe(a, "group:1");

    hub.publish("group:1", { x: 1 });

    expect(a.sent).toHaveLength(1);
  });

  it("cesse de diffuser après désabonnement", () => {
    const a = new FakeClient();
    hub.subscribe(a, "group:1");
    hub.unsubscribe(a, "group:1");

    hub.publish("group:1", { x: 1 });

    expect(a.sent).toEqual([]);
    expect(hub.subscriberCount("group:1")).toBe(0);
  });

  it("removeClient retire le client de tous ses canaux", () => {
    const a = new FakeClient();
    hub.subscribe(a, "group:1");
    hub.subscribe(a, "user:7");

    hub.removeClient(a);

    expect(hub.subscriberCount("group:1")).toBe(0);
    expect(hub.subscriberCount("user:7")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/realtime/RealtimeHub.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/infrastructure/realtime/RealtimeHub.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/realtime/RealtimeHub.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/realtime/RealtimeHub.ts tests/infrastructure/realtime/RealtimeHub.test.ts
git commit -m "feat(realtime): hub pub/sub en mémoire (canal → connexions)"
```

---

### Task 3: Port RealtimeNotifier + impl WsRealtimeNotifier (best-effort)

**Files:**
- Create: `src/application/features/realtime/abstractions/RealtimeNotifier.ts`
- Create: `src/infrastructure/realtime/WsRealtimeNotifier.ts`
- Test: `tests/infrastructure/realtime/WsRealtimeNotifier.test.ts`

**Interfaces:**
- Consumes: `RealtimeHub.publish(channel, payload)` (Task 2) ; `userChannel/groupChannel/sheetChannel` (Task 1).
- Produces:
  - `interface RealtimeNotifier { notifyUserChanged(userId: string, resource: string): void; notifyGroupChanged(groupId: string, resource: string): void; notifySheetChanged(sheetId: string, resource: string): void; }`
  - `class WsRealtimeNotifier implements RealtimeNotifier` (constructeur `(hub: RealtimeHub, logger: Logger)`).
  - L'event publié a la forme `{ type: "invalidate", channel, resource, scopeId }` où `scopeId` = l'id passé.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/infrastructure/realtime/WsRealtimeNotifier.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeHub, RealtimeClient } from "@infrastructure/realtime/RealtimeHub";
import { WsRealtimeNotifier } from "@infrastructure/realtime/WsRealtimeNotifier";
import { FakeLogger } from "../../application/serviceFakes";

class FakeClient implements RealtimeClient {
  public readonly sent: string[] = [];
  public send(data: string): void {
    this.sent.push(data);
  }
}

describe("WsRealtimeNotifier", () => {
  let hub: RealtimeHub;
  let notifier: WsRealtimeNotifier;
  beforeEach(() => {
    hub = new RealtimeHub();
    notifier = new WsRealtimeNotifier(hub, new FakeLogger());
  });

  it("publie un event d'invalidation sur le canal user", () => {
    const client = new FakeClient();
    hub.subscribe(client, "user:u1");

    notifier.notifyUserChanged("u1", "character-sheets");

    expect(JSON.parse(client.sent[0])).toEqual({
      type: "invalidate",
      channel: "user:u1",
      resource: "character-sheets",
      scopeId: "u1",
    });
  });

  it("publie sur le canal group", () => {
    const client = new FakeClient();
    hub.subscribe(client, "group:g1");

    notifier.notifyGroupChanged("g1", "campaigns");

    expect(JSON.parse(client.sent[0])).toEqual({
      type: "invalidate",
      channel: "group:g1",
      resource: "campaigns",
      scopeId: "g1",
    });
  });

  it("publie sur le canal sheet", () => {
    const client = new FakeClient();
    hub.subscribe(client, "sheet:s1");

    notifier.notifySheetChanged("s1", "character-sheet");

    expect(JSON.parse(client.sent[0]).channel).toBe("sheet:s1");
  });

  it("best-effort : une erreur de publication ne se propage pas", () => {
    // Un hub dont publish jette : le notifier doit avaler l'erreur.
    const throwingHub = {
      publish() {
        throw new Error("boom");
      },
    } as unknown as RealtimeHub;
    const safeNotifier = new WsRealtimeNotifier(throwingHub, new FakeLogger());

    expect(() => safeNotifier.notifyUserChanged("u1", "x")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/realtime/WsRealtimeNotifier.test.ts`
Expected: FAIL (modules introuvables).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/application/features/realtime/abstractions/RealtimeNotifier.ts
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
```

```typescript
// src/infrastructure/realtime/WsRealtimeNotifier.ts
import { RealtimeNotifier } from "@application/features/realtime/abstractions/RealtimeNotifier";
import { Logger } from "@application/shared/Logger";
import { RealtimeHub } from "@infrastructure/realtime/RealtimeHub";
import {
  userChannel,
  groupChannel,
  sheetChannel,
} from "@infrastructure/realtime/RealtimeChannels";

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
    } catch (error) {
      this.logger.warn("Échec de publication temps réel (ignoré)", { channel, resource });
      void error;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/realtime/WsRealtimeNotifier.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/application/features/realtime/abstractions/RealtimeNotifier.ts src/infrastructure/realtime/WsRealtimeNotifier.ts tests/infrastructure/realtime/WsRealtimeNotifier.test.ts
git commit -m "feat(realtime): port RealtimeNotifier + impl WebSocket best-effort"
```

---

### Task 4: Parsing du cookie brut du handshake

**Files:**
- Create: `src/infrastructure/realtime/parseCookies.ts`
- Test: `tests/infrastructure/realtime/parseCookies.test.ts`

**Interfaces:**
- Produces: `parseCookies(header: string | undefined): Record<string, string>` — parse l'en-tête HTTP `Cookie` (`"a=1; b=2"`) en objet. Renvoie `{}` si absent.

**Note:** le handshake WS ne passe pas par `cookieParser` d'Express ; on lit l'en-tête brut `req.headers.cookie`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/infrastructure/realtime/parseCookies.test.ts
import { describe, it, expect } from "vitest";
import { parseCookies } from "@infrastructure/realtime/parseCookies";

describe("parseCookies", () => {
  it("parse un en-tête Cookie en paires clé/valeur", () => {
    expect(parseCookies("access_token=abc; refresh_token=def")).toEqual({
      access_token: "abc",
      refresh_token: "def",
    });
  });

  it("gère les valeurs encodées et les espaces", () => {
    expect(parseCookies("a=%20x ; b=y")).toEqual({ a: " x", b: "y" });
  });

  it("renvoie un objet vide si l'en-tête est absent", () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies("")).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/realtime/parseCookies.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/infrastructure/realtime/parseCookies.ts
/**
 * Parse un en-tête HTTP `Cookie` brut (`"a=1; b=2"`) en objet clé→valeur.
 *
 * Nécessaire pour le handshake WebSocket, qui n'a pas le middleware `cookieParser` d'Express :
 * on lit `req.headers.cookie` directement. Les valeurs sont décodées (`decodeURIComponent`).
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (header === undefined || header.trim() === "") {
    return result;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const key = part.slice(0, eq).trim();
    const rawValue = part.slice(eq + 1).trim();
    if (key === "") {
      continue;
    }
    try {
      result[key] = decodeURIComponent(rawValue);
    } catch {
      result[key] = rawValue;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/realtime/parseCookies.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/realtime/parseCookies.ts tests/infrastructure/realtime/parseCookies.test.ts
git commit -m "feat(realtime): parsing du cookie brut pour le handshake WS"
```

---

### Task 5: Serveur WebSocket (auth handshake + abonnements autorisés)

**Files:**
- Create: `src/infrastructure/realtime/WebSocketServer.ts`
- Test: `tests/infrastructure/realtime/WebSocketServer.test.ts`
- Modify: `package.json` (ajouter dépendance `ws` + types)

**Interfaces:**
- Consumes: `RealtimeHub` (Task 2) ; `userChannel/parseChannel` (Task 1) ; `parseCookies` (Task 4) ; `TokenProviderService.verifyAccessToken` ; `ACCESS_TOKEN_COOKIE` ; `GroupAccessService.requireMember(userId, groupId): Promise<Result<...>>`.
- Produces:
  - `interface ChannelAuthorizer { canSubscribe(userId: string, channel: string): Promise<boolean> }` (sépare la décision d'autorisation du transport, pour la tester sans socket).
  - `class RealtimeChannelAuthorizer implements ChannelAuthorizer` — `user:{id}` autorisé seulement si `id === userId` ; `group:{id}` via `groupAccessService.requireMember` ; `sheet:{id}` autorisé si membre du groupe de la fiche (Lot 3 affinera ; pour la fondation, autoriser si l'utilisateur a accès à la fiche via le repository — voir step). Constructeur `(deps)`.
  - `function attachWebSocketServer(httpServer: http.Server, deps: { hub, tokenProvider, authorizer }): void` — attache `ws` sur `path: "/ws"`, vérifie le cookie au handshake (sinon close `4401`), abonne automatiquement à `user:{id}`, traite les messages `subscribe`/`unsubscribe`.

**Decision:** la logique testable (auth handshake → userId, autorisation d'abonnement, routage des messages) est isolée dans des fonctions/classes pures testées unitairement. Le branchement réseau réel (`new WebSocketServer({ server })`) est mince et validé au Lot runtime (spike), pas en test unitaire (on ne monte pas un vrai socket en CI).

- [ ] **Step 1: Add the `ws` dependency**

Run:
```bash
npm install ws && npm install -D @types/ws
```
Expected: `ws` ajouté en `dependencies`, `@types/ws` en `devDependencies`.

- [ ] **Step 2: Write the failing test (authorizer)**

```typescript
// tests/infrastructure/realtime/WebSocketServer.test.ts
import { describe, it, expect } from "vitest";
import { RealtimeChannelAuthorizer } from "@infrastructure/realtime/WebSocketServer";
import { Result } from "@application/shared/Result";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";

/** Fake GroupAccessService : membre des groupes listés dans `memberOf`. */
function fakeGroupAccess(memberOf: Record<string, string[]>) {
  return {
    async requireMember(userId: string, groupId: string) {
      const ok = (memberOf[userId] ?? []).includes(groupId);
      return ok ? Result.success(undefined) : Result.failure(new NotGroupMemberError());
    },
  };
}

describe("RealtimeChannelAuthorizer", () => {
  it("autorise un user à s'abonner à SON propre canal user", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({}),
    } as never);
    expect(await auth.canSubscribe("u1", "user:u1")).toBe(true);
  });

  it("refuse l'abonnement au canal user d'autrui", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({}),
    } as never);
    expect(await auth.canSubscribe("u1", "user:u2")).toBe(false);
  });

  it("autorise le canal group si l'utilisateur est membre", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({ u1: ["g1"] }),
    } as never);
    expect(await auth.canSubscribe("u1", "group:g1")).toBe(true);
    expect(await auth.canSubscribe("u1", "group:g2")).toBe(false);
  });

  it("refuse un canal malformé ou de type inconnu", async () => {
    const auth = new RealtimeChannelAuthorizer({
      groupAccess: fakeGroupAccess({}),
    } as never);
    expect(await auth.canSubscribe("u1", "admin:1")).toBe(false);
    expect(await auth.canSubscribe("u1", "group:")).toBe(false);
  });
});
```

**Note:** ce test ne couvre PAS `sheet:` (qui dépend du repository de fiches) — pour la fondation, l'autoriseur traite `sheet:` au Lot 3. Ici on inclut le cas dans l'impl mais on le teste au Lot 3 quand le repo sera câblé. Pour cette tâche, `sheet:` renvoie `false` par défaut (sera affiné au Lot 3).

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/realtime/WebSocketServer.test.ts`
Expected: FAIL (module/export introuvable).

- [ ] **Step 4: Write the implementation**

```typescript
// src/infrastructure/realtime/WebSocketServer.ts
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { TokenProviderService } from "@application/features/auth/abstractions/services/TokenProviderService";
import { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";
import { ACCESS_TOKEN_COOKIE } from "@presentation/http/features/auth/mappers/AuthHttpMapper";
import { RealtimeHub } from "@infrastructure/realtime/RealtimeHub";
import { userChannel, parseChannel } from "@infrastructure/realtime/RealtimeChannels";
import { parseCookies } from "@infrastructure/realtime/parseCookies";

/** Décide si un utilisateur a le droit de s'abonner à un canal donné. */
export interface ChannelAuthorizer {
  canSubscribe(userId: string, channel: string): Promise<boolean>;
}

/** Dépendances de l'autorisateur de canaux. */
export interface ChannelAuthorizerDeps {
  groupAccess: Pick<GroupAccessService, "requireMember">;
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
    // sheet: affiné au Lot 3.
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/infrastructure/realtime/WebSocketServer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/infrastructure/realtime/WebSocketServer.ts tests/infrastructure/realtime/WebSocketServer.test.ts
git commit -m "feat(realtime): serveur WebSocket auth par cookie + abonnements autorisés"
```

---

### Task 6: Câblage dans main.ts (http.Server + attache WS + notifier injectable)

**Files:**
- Modify: `src/main.ts` (bootstrap : créer le `http.Server`, attacher le WS) ; `buildServices` pour exposer `hub` + `realtimeNotifier`.

**Interfaces:**
- Consumes: `RealtimeHub`, `WsRealtimeNotifier`, `attachWebSocketServer`, `RealtimeChannelAuthorizer`, et le `GroupAccessService` déjà construit dans `buildServices` (vérifier son nom exact dans `services`).
- Produces: `services.realtimeNotifier: RealtimeNotifier` (disponible pour le Lot 3, où les use cases l'injecteront) ; le serveur HTTP sert désormais aussi le WS sur `/ws`.

- [ ] **Step 1: Inspecter le point d'injection**

Lire `src/main.ts` autour de `buildServices` pour récupérer le nom exact du `groupAccessService` dans la structure `services` et confirmer la signature de `AuthServices`. (Le `GroupAccessService` existe déjà — il est utilisé par les use cases campaign/session/sheet.)

- [ ] **Step 2: Modifier `bootstrap()` pour créer un http.Server explicite et attacher le WS**

Remplacer le `app.listen(...)` par un serveur HTTP explicite portant l'app Express ET le WS :

```typescript
// imports à ajouter en tête de main.ts
import http from "node:http";
import { RealtimeHub } from "@infrastructure/realtime/RealtimeHub";
import { WsRealtimeNotifier } from "@infrastructure/realtime/WsRealtimeNotifier";
import {
  attachWebSocketServer,
  RealtimeChannelAuthorizer,
} from "@infrastructure/realtime/WebSocketServer";
```

Dans `bootstrap()`, après `const app = buildHttpApp(...)` :

```typescript
  const hub = new RealtimeHub();
  const authorizer = new RealtimeChannelAuthorizer({
    groupAccess: services.groupAccessService,
  });

  const httpServer = http.createServer(app);
  attachWebSocketServer(httpServer, {
    hub,
    tokenProvider: services.tokenProvider,
    authorizer,
  });

  httpServer.listen(config.port, () => {
    logger.info("Serveur démarré (HTTP + WebSocket /ws)", { port: config.port });
  });
```

(Supprimer l'ancien `app.listen(...)`.)

**Note:** si `services.groupAccessService` n'est pas le nom exact, l'adapter au nom réel relevé au Step 1. Le `hub` et un `new WsRealtimeNotifier(hub, logger)` doivent aussi être rendus disponibles pour le Lot 3 — pour cette tâche, créer le `WsRealtimeNotifier` et le logger, et le stocker là où les use cases pourront l'injecter (selon la structure de `buildControllers`). Si l'injection dans les use cases est plus lourde, la déférer au Lot 3 et, pour cette tâche, se limiter à instancier hub + WS server + notifier sans le câbler aux use cases.

- [ ] **Step 3: Vérifier le build + lint + tests**

Run: `npm run lint && npm run build && npm run test`
Expected: lint clean, build exit 0, tous les tests verts (les nouveaux + les 486 existants).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(realtime): câbler le serveur WebSocket /ws sur le serveur HTTP"
```

---

### Task 7: Spike runtime — connexion WS réelle authentifiée (Lot 0, validation)

**Files:** aucun (validation runtime).

**But:** prouver qu'une connexion WebSocket authentifiée par cookie s'établit en réel contre le backend dev déployé, et qu'un abonnement non autorisé est refusé.

- [ ] **Step 1: Déployer la branche sur dev**

Merger `feat/realtime-invalidation` dans `develop`, pousser, déployer via Vertex (`deploy_ref branch:develop` sur `ejdr-backend-dev`). Attendre `running`.

- [ ] **Step 2: Test handshake non authentifié (doit échouer en 4401)**

Avec un client WS (ex. `wscat` ou un petit script Node), se connecter à `wss://ejdr-backend-dev.vyxs.fr/ws` SANS cookie.
Expected: connexion fermée immédiatement (close code 4401).

- [ ] **Step 3: Test handshake authentifié + abonnement**

Obtenir un `access_token` (login via l'API), se connecter au WS avec ce cookie, envoyer `{"type":"subscribe","channel":"user:<monId>"}`.
Expected: réception de `{"type":"subscribed","channel":"user:<monId>"}`. Tenter `{"type":"subscribe","channel":"user:autre"}` → `{"type":"error",...}`.

- [ ] **Step 4: Documenter le résultat**

Consigner le résultat du spike (OK/KO) dans le suivi. Si OK → la fondation backend est prouvée, on enchaîne sur le plan frontend (Lots 2-3).
