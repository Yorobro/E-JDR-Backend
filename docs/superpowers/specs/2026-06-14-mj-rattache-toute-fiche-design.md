# Le MJ rattache n'importe quelle fiche (sauf les siennes) à sa campagne

**Date** : 2026-06-14
**Statut** : design validé, prêt pour plan d'implémentation
**Repos concernés** : `E-JDR-Backend` (cœur), `E-JDR-Frontend` (UI)
**Branche** : `feat/campaigns`

## Contexte & problème

L'app est privée (cercle d'amis, comptes de confiance), pas un produit grand public.

Aujourd'hui, quand un MJ ouvre le détail de sa campagne et clique « Rattacher une fiche »,
le dialog ne liste que **ses propres** fiches (`GET /character-sheets` → `findByOwnerId`).
La fiche créée par un autre joueur n'apparaît donc jamais. C'est conforme au design initial
(« on ne rattache que ses propres fiches »), mais ce n'est pas le comportement souhaité.

**Comportement voulu** : quand le MJ rattache une fiche à sa campagne, il doit voir et pouvoir
rattacher **toutes les fiches de la base SAUF les siennes** (la règle MJ≠joueur est conservée :
le MJ ne joue pas dans sa propre campagne).

## Décisions (validées avec l'utilisateur)

1. **Portée des fiches rattachables** : toutes les fiches dont le propriétaire ≠ MJ de la campagne,
   moins celles déjà rattachées à cette campagne. (« Toutes sauf les siennes propres ».)
2. **Autorisation du rattachement** (`POST /campaigns/:id/characters`) : **seul le MJ** de la
   campagne. On abandonne l'exigence « être propriétaire de la fiche ».
3. **Autorisation du détachement** (`DELETE …/:sheetId`) : **seul le MJ** (avant : MJ ou propriétaire).
4. **Endpoint de listing** : **nouvel endpoint dédié par campagne**
   `GET /campaigns/:campaignId/linkable-characters`. Toute la logique reste au back ; le front affiche brut.

**Conservé** : la règle MJ≠joueur (`GM_CANNOT_JOIN_OWN_CAMPAIGN`, 409), l'anti-doublon
(`SHEET_ALREADY_IN_CAMPAIGN`, 409), la séparation `users`/`credentials`, l'architecture clean 4 couches,
`Result<T,E>`, DAO=SQL pur / Repository=assemblage.

## Implication de confidentialité (actée)

`GET /campaigns/:id/linkable-characters` expose le nom + le propriétaire des fiches de **tous les
autres comptes** à n'importe quel MJ. C'est voulu (app privée entre amis). Ça lève l'isolation
inter-comptes qui existait jusqu'ici. L'erreur `CHARACTER_SHEET_ACCESS_DENIED` (403) change de sens :
« tu n'es pas le MJ de cette campagne » (avant : « ce n'est pas ta fiche »).

## Changements — récapitulatif des règles

| Opération | Règle actuelle | Nouvelle règle |
|---|---|---|
| Lister les fiches rattachables | n'existe pas (front liste *mes* fiches) | **Nouveau** : fiches dont owner ≠ MJ, hors déjà rattachées. Réservé au MJ. |
| Rattacher (`POST /campaigns/:id/characters`) | demandeur = propriétaire de la fiche | demandeur = **MJ de la campagne** |
| Détacher (`DELETE …/:sheetId`) | MJ **ou** propriétaire | **MJ seul** |
| Règle MJ≠joueur | une fiche du MJ ne peut pas entrer dans sa campagne | **conservée** |

## Backend (E-JDR-Backend)

### Nouveau use case — `ListLinkableCharactersUseCaseImpl` (lecture pure)
`src/application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl.ts`

- Entrée : `{ campaignId, actorUserId }` (actorUserId = `req.user`).
- Logique :
  1. campagne absente ⇒ `CampaignNotFoundError` (404) ;
  2. `campaign.isGameMaster(actorUserId)` faux ⇒ `CharacterSheetAccessDeniedError` (403, sens « pas le MJ ») ;
  3. récupère via le repo les fiches rattachables (owner ≠ MJ, hors déjà liées) ;
  4. projette en `CharacterSheetSummary[]` (DTO existant : `id, ownerId, name, createdAt`).
- Lecture pure → **pas de UnitOfWork**, repos directs (modèle `ListMyCharacterSheetsUseCaseImpl`).
- Nouveaux ports : `ListLinkableCharactersUseCase` (abstractions/usecases) + `ListLinkableCharactersQuery`.

### Port `CharacterSheetRepository` — nouvelle méthode
```ts
/** Fiches rattachables à une campagne : owner ≠ MJ, hors fiches déjà liées à cette campagne. */
findLinkableForCampaign(gameMasterId: string, campaignId: string): Promise<CharacterSheet[]>;
```
Implémentation MySQL = **une requête SQL** (filtre métier dans le DAO, pas en mémoire) :
```sql
SELECT cs.* FROM character_sheets cs
WHERE cs.owner_id <> ?
  AND NOT EXISTS (
    SELECT 1 FROM campaign_characters cc
    WHERE cc.character_sheet_id = cs.id AND cc.campaign_id = ?
  );
```
DAO = SQL pur (nouvelle requête dans `CharacterSheetDao`), Repository = assemblage + mapping.

### Use cases existants modifiés
- **`LinkCharacterToCampaignUseCaseImpl`** : remplacer `sheet.isOwnedBy(actorUserId)` (sinon 403) par
  `campaign.isGameMaster(actorUserId)` (sinon 403). La règle MJ≠joueur (`campaign.isGameMaster(sheet.ownerId)`
  ⇒ 409) **reste**. MAJ JSDoc.
- **`UnlinkCharacterFromCampaignUseCaseImpl`** : remplacer `isGameMaster || isOwnedBy` par
  `isGameMaster` seul. MAJ JSDoc.

### Endpoint + wiring
- Route `GET /campaigns/:campaignId/linkable-characters` (routeur campagne existant, derrière `authMiddleware`).
- Nouvelle méthode dans `CampaignCharacterController` : `gameMasterId` = `req.user`, réponse `200 { characters: [...] }`.
- `main.ts` : câbler le use case dans `buildCampaignCharacterController`. ⚠️ ESLint `ejdr/parameter-count`
  (max 6) — si le constructeur du controller dépasse, regrouper en objet (pattern `HttpControllers` déjà
  présent dans le projet).
- Doc : ajouter l'endpoint dans `docs/CONTRAT_API.md`.

## Frontend (E-JDR-Frontend)

Front anémique et bête : il affiche ce que le back renvoie, **sans filtrer** (la logique est au back).

### Application
- `CampaignRepository` (port) + impl HTTP : `listLinkableCharacters(campaignId): Result<List<CharacterSheet>, …>`
  → `GET /campaigns/:id/linkable-characters`. Modèle exact de `listCampaignCharacters` (runCatchingCancellable,
  mapper HTTP→domaine). **Placement** : au même endroit que `listCampaignCharacters` (vérifier lequel des deux
  repos — campaign/charactersheet — le porte et s'aligner).
- Nouveau use case `ListLinkableCharactersUseCase` (+ `Impl`).

### Présentation
- `CampaignDetailViewModel` : remplacer `listMySheets()` par `listLinkableCharacters(campaignId)` ; **renommer**
  `_mySheets`/`mySheets` → `_linkableSheets`/`linkableSheets` (le nom ne doit pas mentir sur le contenu) ;
  recharge déjà après link/unlink. Mettre à jour l'injection (`ListCharacterSheetsUseCase` →
  `ListLinkableCharactersUseCase`) et le module Koin concerné.
- `LinkCharacterDialog` : aucune logique modifiée. Ajuster le texte vide
  « Aucune fiche disponible. Créez-en une dans Mes fiches. » → « Aucune fiche rattachable pour le moment. »
- `CampaignDetailPage` : passe `linkableSheets` au dialog (cosmétique).

Pas de nouvelle Route, pas de changement Nav3 → aucun des deux pièges runtime Nav3 n'est touché.

### Kover
Le VM reste compté ; dialog/page restent exclus (UI Compose). Rien à changer dans les exclusions.

## Tests & vérification

### Backend (Vitest)
- **Nouveau** `ListLinkableCharactersUseCaseImpl.test.ts` : campagne absente → 404 ; demandeur ≠ MJ → 403 ;
  succès → fiches des autres comptes, exclut celles du MJ et les déjà rattachées ; aucune rattachable → liste vide.
- `LinkCharacterToCampaignUseCaseImpl.test.ts` (MAJ) : non-MJ → 403 ; MJ rattache la fiche d'un autre → succès ;
  MJ rattache **sa propre** fiche → toujours 409 `GM_CANNOT_JOIN_OWN_CAMPAIGN` ; doublon → 409.
- `UnlinkCharacterFromCampaignUseCaseImpl.test.ts` (MAJ) : MJ → succès ; propriétaire non-MJ → désormais **403** ;
  tiers → 403.
- `tests/application/fakes.ts` : ajouter `findLinkableForCampaign` au `FakeCharacterSheetRepository`.
- **DAO Testcontainers** : test SQL de `findLinkableForCampaign` (exclut owner=MJ + déjà liées).
  ⚠️ Ne tourne pas en local sans Docker → `npm run test:db` à lancer par l'utilisateur.
- Garde-fous : `npm test` vert, `lint` 0, `format:check`, `tsc --noEmit` (src + tests).

### Frontend (JUnit5 + MockK)
- `CampaignDetailViewModelTest.kt` (MAJ) : stub `listLinkableCharacters` ; vérifier `linkableSheets` alimenté
  au `load()` + rechargé après link/unlink.
- Nouveau test du use case + du repo HTTP (ktor-client-mock) sur le nouveau path.
- `./gradlew verify` (detekt 0 + tests + Kover ≥60%).
- ⚠️ **Validation runtime à la charge de l'utilisateur** (`./gradlew run`, backend up) :
  2 comptes, l'un crée une campagne, l'autre une fiche → le MJ ouvre sa campagne → « Rattacher » → **voit la
  fiche de l'autre** → rattache → détache. Tester aussi que sa propre fiche n'apparaît pas / est refusée (409).

## Hors périmètre (YAGNI)

- Pas de parcours « un joueur rejoint la campagne d'un autre MJ » (invitations, codes, écran « campagnes où je joue »).
- Pas de re-typage en value objects d'identité.
- Pas de pagination du listing des fiches rattachables (volume faible, app privée).
