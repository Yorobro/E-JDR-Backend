# Temps réel — Synchronisation multi-appareils par invalidation

**Date** : 2026-06-21
**Statut** : Design validé, prêt pour plan d'implémentation
**Périmètre** : Backend (E-JDR-Backend) + Frontend (E-JDR-Frontend, Compose Desktop)

## 1. Objectif

Rendre l'application réactive entre appareils connectés au même compte ou au même
groupe : quand un appareil modifie une donnée (ajoute une fiche, envoie une invitation,
édite une fiche ouverte…), les autres appareils concernés se mettent à jour **sans action
manuelle**.

Cible long terme : « presque tout réactif » (listes, invitations/notifications, fiche
ouverte). Ce document conçoit la **fondation générique** + une **feature pilote**, et liste
les extensions prévues qui se brancheront ensuite sur la même mécanique.

## 2. Décisions de cadrage (validées)

| Sujet | Décision |
|---|---|
| Modèle de mise à jour | **Invalidation** : le serveur signale « le périmètre X a changé », le client recharge via l'API REST existante (pas d'envoi du contenu). |
| Diffusion | **Canaux ciblés par type d'événement** (pub/sub par topic), pas une diffusion unique. |
| Transport | **WebSocket** (lib `ws` côté Node ; seam Ktor WS déjà présent côté front). Faisabilité Vertex **vérifiée** : le proxy nginx transmet l'upgrade WS jusqu'à l'app (handshake `/ws` reçu, 404 applicatif car pas encore de handler). |
| Échec de notification | **Best-effort** : l'échec d'une publication temps réel ne fait jamais échouer l'action métier. |
| Reconnexion | **Reconnecte + réabonne + recharge** les écrans visibles (pas de file d'attente d'events serveur). |
| Auth WS | **Réutilise le cookie JWT `access_token`** existant, vérifié au handshake. Pas de token séparé. |
| Découpage | **Fondation complète + 1 feature pilote** (liste des fiches d'un groupe), puis branchement incrémental du reste. |

## 3. Architecture générale

```
┌─────────────┐   1. action (POST/PUT/DELETE via REST)      ┌──────────────┐
│  Desktop    │ ──────────────────────────────────────────► │   Backend    │
│             │   2. réponse REST normale  ◄──────────────── │   (Node)     │
└─────────────┘                                              │  ┌─────────┐ │
┌─────────────┐   0. connexion WS + abonnement aux canaux    │  │Realtime │ │
│  Mobile     │ ◄═══════════════════════════════════════════►│  │  Hub    │ │
│ (même user) │   3. event "group:X invalidé" (push WS)       │  │(pub/sub)│ │
│             │   4. recharge la liste via REST ─────────────►│  └─────────┘ │
└─────────────┘                                              └──────────────┘
```

- **Backend** : serveur WebSocket (`ws`) greffé sur le serveur HTTP Express existant (même
  port, chemin `/ws`), authentifié via le cookie JWT. Un **Realtime Hub** en mémoire mappe
  `canal → connexions abonnées` et expose `publish/subscribe/unsubscribe`. Les use cases
  existants publient un événement d'invalidation **après** une écriture réussie.
- **Frontend** : on branche le **seam existant** (`RealtimeConnection` / `KtorRealtimeConnection`
  / `RealtimeTransport` / `KtorWebSocketTransport`, dans `di/RealtimeModule`). Un dispatcher
  reçoit les events et notifie les ViewModels concernés, qui rechargent via leurs use cases
  REST actuels.

**Réutilisé sans réécriture** : toute l'API REST, les repositories, les écrans, l'infra WS
front, le système d'auth JWT.

## 4. Canaux & abonnements

Trois types de canaux, chacun avec sa règle d'abonnement et d'autorisation. **L'autorisation
est vérifiée côté serveur au moment de l'abonnement, à partir du JWT — jamais sur la base de
ce que le client prétend.**

| Canal | Format | Qui s'abonne | Autorisation à l'abonnement |
|---|---|---|---|
| Utilisateur | `user:{userId}` | Tes propres appareils, **en permanence** dès la connexion WS | Automatique : seulement TON `user:{id}` (tiré du JWT) |
| Groupe | `group:{groupId}` | Les appareils dont le groupe actif = ce groupe | `GroupAccessService.requireMember(userId, groupId)` |
| Fiche | `sheet:{sheetId}` | Les appareils ayant **ouvert** cette fiche (éphémère) | Accès à la fiche (membre du groupe de la fiche) |

Règles :
- `user:{id}` **automatique et permanent** : fait fonctionner les invitations indépendamment
  du groupe actif.
- `group:{id}` **suit le groupe actif** (`ActiveGroupState`) : changement de groupe →
  désabonnement de l'ancien, abonnement au nouveau. Une seule connexion WS, abonnements
  évolutifs.
- `sheet:{id}` **éphémère** : abonnement à l'ouverture de l'écran détail, désabonnement à la
  fermeture.

Protocole d'abonnement (client → serveur) :
```json
{ "type": "subscribe",   "channel": "group:42" }
{ "type": "unsubscribe", "channel": "sheet:99" }
```
Le serveur répond par un accusé (`subscribed`) ou une erreur (`error`) si l'abonnement est
refusé (non membre, etc.).

## 5. Protocole d'événements (serveur → client)

Événement = signal d'invalidation (ce qui a changé, pas le contenu) :
```json
{
  "type": "invalidate",
  "channel": "group:42",
  "resource": "character-sheets",
  "scopeId": "42"
}
```
- `channel` : canal de diffusion.
- `resource` : ressource à recharger (`character-sheets`, `campaigns`, `sessions`,
  `invitations`, `character-sheet`…).
- `scopeId` : identifiant du périmètre (groupe ou fiche) pour cibler le rechargement.

Catalogue cible (le pilote n'implémente que la 1re ligne ; le reste est l'extension prévue) :

| Déclencheur (use case REST) | Canal | resource | Effet client | Lot |
|---|---|---|---|---|
| Créer / supprimer une fiche | `user:{ownerId}` | `character-sheets` | recharge « Mes fiches » sur mes autres appareils | **Pilote** |
| Inviter un membre | `user:{invitedUserId}` | `invitations` | met à jour le badge/notif d'invitation | Extension |
| Modifier une fiche | `sheet:{sheetId}` | `character-sheet` | recharge la fiche ouverte | Extension |
| Créer / supprimer campagne | `group:{groupId}` | `campaigns` | recharge la liste des campagnes | Extension |
| Créer / supprimer session | `group:{groupId}` | `sessions` | recharge les sessions | Extension |

> **Note sur le canal du pilote** : l'écran de liste est `MyCharacterSheetsPage` (« Mes
> fiches »), **filtré au propriétaire**. Le bon périmètre est donc `user:{ownerId}` (mes
> propres appareils), pas `group:` — c'est exactement le cas « j'ajoute une fiche sur le
> desktop, elle apparaît sur mon mobile ». Le canal `group:` reste utilisé par les listes
> réellement partagées (campagnes, sessions — extensions). Avantage : le pilote n'a même pas
> besoin de vérifier l'appartenance à un groupe (le canal `user:` est auto-autorisé).

### Publication depuis un use case (clean archi)

Règle : **publier UNIQUEMENT si l'écriture a réussi (après commit)**, en best-effort.

- Port `RealtimeNotifier` (couche **application**) : ex. `notifyGroupChanged(groupId, resource)`,
  `notifyUserChanged(userId, resource)`, `notifySheetChanged(sheetId, resource)`.
- Le use case (ex. `CreateCharacterSheetUseCase`) appelle ce port **après** le succès, comme
  il appelle déjà ses repositories. Il ne sait pas que c'est du WebSocket : il dépend de
  l'interface.
- Implémentation `WsRealtimeNotifier` (couche **infrastructure**) → `hub.publish("group:42", {...})`.
- **Best-effort** : une erreur de publication est avalée (try/catch + log), elle ne remonte
  jamais dans le `Result` du use case.
- Testable avec un `FakeRealtimeNotifier` (vérifie les appels sans WS réel).

## 6. Authentification de la connexion WebSocket

1. **Handshake** : le serveur `ws` s'attache au serveur HTTP via l'événement `upgrade`. Les
   cookies sont envoyés automatiquement (même domaine). Le serveur lit `access_token`, le
   vérifie avec `TokenProviderService` (identique au REST). Valide → connexion acceptée,
   `userId` attaché. Invalide/absent → handshake **refusé** (close code `4401`), la connexion
   n'est jamais établie.
2. **`userId` vient du JWT, jamais du client** : détermine l'abonnement auto `user:{id}` et
   autorise les abonnements `group:`/`sheet:`. Pas d'usurpation possible.
3. **Expiration en cours de connexion** : l'access token dure 1h. Le seam front prévoit un
   « refresh proactif » : le client rafraîchit son access token via `/auth/refresh` (rendu
   multi-appareils, cf. `multi-device-refresh-fix`) avant expiration ; la connexion WS
   continue. En dernier recours, si le token expire, le serveur ferme proprement et le client
   se reconnecte (avec rechargement).

## 7. Robustesse

- **Échec de publication** : best-effort, n'impacte jamais l'action métier (la création de
  fiche renvoie 201 même si la notif échoue ; les autres appareils rateront ce rafraîchissement
  instantané et se synchroniseront au prochain chargement).
- **Coupure / reconnexion WS** : à la reconnexion, l'appareil se réabonne à ses canaux ET
  recharge les écrans visibles via REST (couvre les events manqués pendant la coupure). Pas
  d'état serveur par session, pas de file de rejeu. Le seam front a déjà reconnexion + backoff.

## 8. Découpage de la livraison

**Lot 0 — Spike de faisabilité**
- Back : brancher `ws` sur Express, endpoint `/ws`, accepter une connexion authentifiée par
  cookie, répondre à un ping.
- Front : connecter `KtorWebSocketTransport` au `/ws` dev, confirmer connexion stable.
- Critère : une connexion WS authentifiée s'ouvre en réel (desktop → backend dev). Proxy
  nginx déjà confirmé compatible.

**Lot 1 — Fondation backend**
- `RealtimeHub` (pub/sub mémoire : `subscribe/unsubscribe/publish`).
- Auth au handshake (cookie JWT, abonnement auto `user:{id}`).
- Messages `subscribe`/`unsubscribe` avec autorisation (`requireMember` pour `group:`, accès
  fiche pour `sheet:`).
- Port `RealtimeNotifier` (application) + impl `WsRealtimeNotifier` (infra), câblés dans
  `main.ts`.
- Tests : unitaires Hub (abonnement, diffusion, refus non autorisé) + fake notifier.

**Lot 2 — Fondation frontend**
- Dispatcher d'événements : route les `invalidate` vers les ViewModels concernés.
- Abonnements pilotés par l'état (`group:` suit `ActiveGroupState`, `user:` permanent).
- Reconnexion → réabonnement + rechargement des écrans visibles.
- Tests : dispatcher (mock transport) ; le seam WS a déjà ses tests.

**Lot 3 — Feature pilote : « Mes fiches » en temps réel (canal `user:`)**
- Back : `CreateCharacterSheetUseCase` et `DeleteCharacterSheetUseCase` appellent
  `notifier.notifyUserChanged(ownerId, "character-sheets")` après succès.
- Front : `MyCharacterSheetsViewModel` recharge sur l'event `character-sheets` reçu sur le
  canal `user:` (auquel l'appareil est déjà abonné automatiquement — aucun abonnement explicite
  à gérer pour le pilote).
- Critère de succès : desktop + mobile connectés au même compte ; ajouter une fiche sur l'un →
  elle apparaît dans « Mes fiches » de l'autre **sans action manuelle**.

**Lot 4 — Validation runtime réelle**
- Déploiement dev, test desktop (assistant) + mobile (user), comme pour le fix multi-appareils.

**Extensions prévues (hors premier chantier, design couvert)** : invitations (`user:`), fiche
ouverte éditée (`sheet:`), campagnes & sessions (`group:`). Chacune ≈ un appel `notify` côté
use case + un abonnement côté ViewModel.

## 9. Approche de développement

- **TDD** à chaque lot (Hub, dispatcher, use cases avec fake notifier).
- **Validation runtime réelle** en fin (les tests ne suffisent pas pour du WS desktop : sur
  Compose Desktop, lancer `./gradlew run` et vérifier en réel — cf. leçon Nav3).
- Dev sur branche `feat/realtime-invalidation` (à partir de `develop`), déploiement dev Vertex
  pour la validation.

## 10. Hors périmètre (YAGNI)

- Pas d'envoi du contenu dans les events (invalidation seulement).
- Pas de file de rejeu d'events côté serveur.
- Pas de résolution de conflit d'édition concurrente sur une même fiche (le dernier
  enregistrement gagne, comme aujourd'hui ; le temps réel rend juste le changement visible).
- Pas d'i18n des messages (cohérent avec le refus i18n existant).
