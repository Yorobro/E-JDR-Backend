# Refonte profil + rôles MJ & contrôle d'accès — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un rôle de groupe MJ avec lecture seule pour les MEMBER, une page profil (changer email/mot de passe + déconnexion), et un gating de navigation tant qu'aucun groupe n'est actif.

**Architecture:** Le back est la source de vérité des autorisations (nouveau `requireEditor` sur `GroupAccessService`, nouveaux use cases profil) ; le front masque l'UI selon le rôle exposé pour le groupe actif. Clean architecture par feature respectée des deux côtés.

**Tech Stack:** Back = Node + TypeScript + Express + Drizzle (MySQL) + Vitest. Front = Kotlin + Compose Desktop + Ktor + Koin + JUnit/MockK + Kover.

## Global Constraints

- Back : `npm run lint` zéro warning, `npm run build` OK, `npm run test` vert avant chaque commit de fin de tâche. Conventional commits (commitlint). Migrations Drizzle **forward-only**, additives.
- Front : `./gradlew verify` (detekt + tests + kover ≥ 60%) vert. Result railway-oriented, `runCatchingCancellable` pour tout appel suspendu. Pas de `!!`/`runCatching` brut sur appels réseau.
- Rôles de groupe : valeurs exactes `ADMIN`, `MJ`, `MEMBER` (majuscules). « Éditeur » = rôle ∈ {ADMIN, MJ}.
- Co-author de chaque commit : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## PHASE A — BACKEND

### Task A1 : Ajouter la valeur de rôle `MJ` (domaine)

**Files:**
- Modify: `src/domain/features/friend-group/value-objects/GroupRole.ts`
- Test: `tests/domain/GroupRole.test.ts` (créer si absent)

**Interfaces:**
- Produces: `GroupRole.MJ` (static), `GroupRole.create("MJ")` valide, `groupRole.isEditor(): boolean` (true pour ADMIN et MJ).

- [ ] **Step 1 : Écrire le test d'échec**

```typescript
// tests/domain/GroupRole.test.ts
import { describe, it, expect } from "vitest";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";

describe("GroupRole", () => {
  it("accepte MJ", () => {
    expect(GroupRole.create("MJ").value).toBe("MJ");
  });
  it("isEditor vrai pour ADMIN et MJ, faux pour MEMBER", () => {
    expect(GroupRole.ADMIN.isEditor()).toBe(true);
    expect(GroupRole.MJ.isEditor()).toBe(true);
    expect(GroupRole.MEMBER.isEditor()).toBe(false);
  });
  it("rejette un rôle inconnu", () => {
    expect(() => GroupRole.create("BOSS")).toThrow();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run tests/domain/GroupRole.test.ts`
Expected: FAIL (`GroupRole.MJ` undefined / `isEditor` n'existe pas).

- [ ] **Step 3 : Implémenter**

Dans `GroupRole.ts` : ajouter la constante et la branche `case`, et la méthode `isEditor`.

```typescript
export class GroupRole {
  public static readonly ADMIN = new GroupRole("ADMIN");
  public static readonly MJ = new GroupRole("MJ");
  public static readonly MEMBER = new GroupRole("MEMBER");

  private constructor(public readonly value: string) {}

  public static create(raw: string): GroupRole {
    switch (raw) {
      case "ADMIN":
        return GroupRole.ADMIN;
      case "MJ":
        return GroupRole.MJ;
      case "MEMBER":
        return GroupRole.MEMBER;
      default:
        throw new InvalidGroupRoleError(raw);
    }
  }

  public isAdmin(): boolean {
    return this.value === "ADMIN";
  }

  /** Éditeur de contenu du groupe : ADMIN ou MJ (par opposition au MEMBER en lecture seule). */
  public isEditor(): boolean {
    return this.value === "ADMIN" || this.value === "MJ";
  }

  public toString(): string {
    return this.value;
  }
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `npx vitest run tests/domain/GroupRole.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/domain/features/friend-group/value-objects/GroupRole.ts tests/domain/GroupRole.test.ts
git commit -m "feat(group): ajouter le rôle MJ (éditeur de contenu)"
```

---

### Task A2 : `GroupMembership.isEditor()` + `requireEditor` sur le service d'accès

**Files:**
- Modify: `src/domain/features/friend-group/entities/GroupMembership.ts` (ajouter `isEditor()`)
- Modify: `src/application/features/friend-group/abstractions/services/GroupAccessService.ts` (ajouter `requireEditor` à l'interface)
- Modify: `src/application/features/friend-group/services/GroupAccessServiceImpl.ts` (implémenter)
- Create: `src/application/features/friend-group/errors/NotGroupEditorError.ts`
- Test: `tests/application/GroupAccessService.test.ts` (créer)

**Interfaces:**
- Consumes: `GroupRole.isEditor()` (Task A1), `groupMemberRepository.findByUserIdAndGroupId`.
- Produces: `GroupAccessService.requireEditor(userId, groupId): Promise<Result<void, AppError>>` ; `NotGroupEditorError` (code `NOT_GROUP_EDITOR`) ; `GroupMembership.isEditor(): boolean`.

- [ ] **Step 1 : Créer l'erreur**

```typescript
// src/application/features/friend-group/errors/NotGroupEditorError.ts
import { AppError } from "@application/errors/AppError";

export class NotGroupEditorError extends AppError {
  constructor() {
    super("NOT_GROUP_EDITOR", "Seuls les administrateurs et les MJ peuvent modifier ce contenu.");
  }
}
```

- [ ] **Step 2 : Ajouter `isEditor` à l'entité**

Dans `GroupMembership.ts`, à côté de `isAdmin()` :
```typescript
public isEditor(): boolean {
  return this.props.role.isEditor();
}
```

- [ ] **Step 3 : Écrire le test d'échec**

```typescript
// tests/application/GroupAccessService.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import {
  buildFakeTransactionalRepositories,
  buildTestMembership,
} from "./fakes";

describe("GroupAccessService.requireEditor", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let service: GroupAccessServiceImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    service = new GroupAccessServiceImpl(repos.groupMembers, repos.campaigns, repos.campaignCharacters);
  });

  it("autorise un ADMIN", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "u", role: GroupRole.ADMIN }));
    expect((await service.requireEditor("u", "group-1")).isSuccess).toBe(true);
  });
  it("autorise un MJ", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "u", role: GroupRole.MJ }));
    expect((await service.requireEditor("u", "group-1")).isSuccess).toBe(true);
  });
  it("refuse un MEMBER avec NOT_GROUP_EDITOR", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "u", role: GroupRole.MEMBER }));
    const r = await service.requireEditor("u", "group-1");
    expect(r.isFailure).toBe(true);
    expect(r.error.code).toBe("NOT_GROUP_EDITOR");
  });
  it("refuse un non-membre avec NOT_GROUP_MEMBER", async () => {
    const r = await service.requireEditor("absent", "group-1");
    expect(r.error.code).toBe("NOT_GROUP_MEMBER");
  });
});
```

- [ ] **Step 4 : Lancer, vérifier l'échec**

Run: `npx vitest run tests/application/GroupAccessService.test.ts`
Expected: FAIL (`requireEditor` n'existe pas).

- [ ] **Step 5 : Ajouter à l'interface + implémenter**

Interface `GroupAccessService.ts` : ajouter `requireEditor(userId: string, groupId: string): Promise<Result<void, AppError>>;`

Impl `GroupAccessServiceImpl.ts` (après `requireAdmin`) :
```typescript
public async requireEditor(userId: string, groupId: string): Promise<Result<void, AppError>> {
  const membership = await this.groupMemberRepository.findByUserIdAndGroupId(userId, groupId);
  if (membership === null) {
    return Result.failure(new NotGroupMemberError());
  }
  if (!membership.isEditor()) {
    return Result.failure(new NotGroupEditorError());
  }
  return Result.success(undefined);
}
```
Importer `NotGroupEditorError` en tête.

- [ ] **Step 6 : Lancer, vérifier le succès**

Run: `npx vitest run tests/application/GroupAccessService.test.ts`
Expected: PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/domain/features/friend-group/entities/GroupMembership.ts src/application/features/friend-group/abstractions/services/GroupAccessService.ts src/application/features/friend-group/services/GroupAccessServiceImpl.ts src/application/features/friend-group/errors/NotGroupEditorError.ts tests/application/GroupAccessService.test.ts
git commit -m "feat(group): requireEditor (ADMIN/MJ) sur le service d'accès"
```

---

### Task A3 : Brancher `requireEditor` sur les catalogues de référence

**Files:**
- Modify: `src/application/features/reference/usecases/ReferenceCatalogueUseCaseImpls.ts` (Create/Update/Delete : `requireAdmin` → `requireEditor`)
- Test: `tests/application/ReferenceCatalogueUseCase.test.ts` (ajouter cas MJ autorisé, MEMBER refusé)

**Interfaces:**
- Consumes: `GroupAccessService.requireEditor` (Task A2).

- [ ] **Step 1 : Écrire les tests d'échec** (ajouter au describe existant)

```typescript
it("autorise un MJ à créer un élément", async () => {
  txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-mj", role: GroupRole.MJ }));
  const result = await createUseCase().execute({ groupId: "group-1", actorId: "u-mj", name: "Épée MJ" });
  expect(result.isSuccess).toBe(true);
});
it("refuse un MEMBER de créer un élément (NOT_GROUP_EDITOR)", async () => {
  txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-mem", role: GroupRole.MEMBER }));
  const result = await createUseCase().execute({ groupId: "group-1", actorId: "u-mem", name: "Refusé" });
  expect(result.isFailure).toBe(true);
  expect(result.error.code).toBe("NOT_GROUP_EDITOR");
});
```
(Importer `GroupRole` en tête du fichier de test s'il ne l'est pas déjà.)

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run tests/application/ReferenceCatalogueUseCase.test.ts`
Expected: FAIL (MEMBER actuellement refusé par `requireAdmin` avec code `NOT_GROUP_ADMIN`, MJ refusé aussi).

- [ ] **Step 3 : Remplacer dans les 3 use cases**

Dans `ReferenceCatalogueUseCaseImpls.ts`, pour Create/Update/Delete : remplacer chaque `this.groupAccessService.requireAdmin(` par `this.groupAccessService.requireEditor(`. (3 occurrences attendues — vérifier par grep `requireAdmin` dans le fichier.)

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `npx vitest run tests/application/ReferenceCatalogueUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/application/features/reference/usecases/ReferenceCatalogueUseCaseImpls.ts tests/application/ReferenceCatalogueUseCase.test.ts
git commit -m "feat(reference): édition des catalogues réservée aux éditeurs (ADMIN/MJ)"
```

---

### Task A4a : Brancher `requireEditor` sur les campagnes (écriture)

**État vérifié :** dans `campaign/usecases/`, 3 appels à `requireMember` :
`CreateCampaignUseCaseImpl.ts:29` (écriture → passe à `requireEditor`),
`DeleteCampaignUseCaseImpl.ts:45` (écriture → `requireEditor`),
`ListMyCampaignsUseCaseImpl.ts:18` (LECTURE → **reste `requireMember`**).

**Files:**
- Modify: `src/application/features/campaign/usecases/CreateCampaignUseCaseImpl.ts:29` (`requireMember` → `requireEditor`)
- Modify: `src/application/features/campaign/usecases/DeleteCampaignUseCaseImpl.ts:45` (`requireMember` → `requireEditor`)
- Test: `tests/application/CreateCampaignUseCase.test.ts`, `tests/application/DeleteCampaignUseCase.test.ts`

**Interfaces:**
- Consumes: `GroupAccessService.requireEditor`. Les use cases campagne ont DÉJÀ `groupAccessService` en dépendance (ils appellent `requireMember`).

- [ ] **Step 1 : Tests d'échec** — pour Create et Delete : un MJ réussit, un MEMBER échoue avec `NOT_GROUP_EDITOR`. (Lire chaque fichier de test pour la signature exacte des commandes et le seed de rôle ; importer `GroupRole`.)
- [ ] **Step 2 : Lancer, vérifier l'échec** — `npx vitest run tests/application/CreateCampaignUseCase.test.ts tests/application/DeleteCampaignUseCase.test.ts`
- [ ] **Step 3 : Remplacer** `requireMember` → `requireEditor` dans Create + Delete (PAS dans ListMyCampaigns).
- [ ] **Step 4 : Suite + régressions** — `npx vitest run tests/application` ; ajuster tout test supposant qu'un MEMBER crée/supprime une campagne (passer à ADMIN/MJ).
- [ ] **Step 5 : Commit** — `git commit -m "feat(campaign): création/suppression de campagne réservée aux éditeurs (ADMIN/MJ)"`

---

### Task A4b : Aligner les sessions sur les rôles de groupe

**Décision (validée) :** les sessions étaient gouvernées par `campaign.isGameMaster(actor)` (gameMasterId) pour TOUTES les opérations, y compris la lecture. Nouveau modèle :
- **Écriture** (Create/Update/Delete) → `requireEditor(actor, campaign.groupId)`.
- **Lecture** (Get/List) → `requireMember(actor, campaign.groupId)` (tout membre voit les sessions).

**État vérifié :** les 5 use cases session (`Create/Update/Delete/Get/ListCampaignSessions`) vérifient `campaign.isGameMaster(actor)` et **n'ont PAS** `groupAccessService` en dépendance (constructeurs : `campaignRepository, [sessionRepository], [idGenerator], unitOfWork, logger`). `Campaign` expose `groupId` (getter `Campaign.ts:76`). Le wiring est `buildSessionController.ts` (instancie les 5) + `main.ts` (l'appelle avec `SessionControllerDeps`).

**Files:**
- Modify: les 5 `src/application/features/session/usecases/*UseCaseImpl.ts` (injecter `groupAccessService`, remplacer le check `isGameMaster`)
- Modify: `src/presentation/http/features/session/buildSessionController.ts` (ajouter `groupAccessService` aux `SessionControllerDeps` et le passer aux 5 use cases)
- Modify: `src/main.ts` (passer `groupAccessService` — déjà disponible, retourné par `buildGroupControllers` — dans les deps du session controller)
- Test: les fichiers de test session sous `tests/application/` (adapter : le MJ-de-campagne n'est plus le critère ; c'est le rôle de groupe)

**Interfaces:**
- Consumes: `GroupAccessService.requireEditor` / `requireMember`, `Campaign.groupId`.

> NOTE : conserver `CampaignNotFoundError` quand la campagne est absente. Remplacer uniquement le
> `if (!campaign.isGameMaster(actor)) return CampaignAccessDeniedError()` par :
> écriture → `const acc = await this.groupAccessService.requireEditor(actor, campaign.groupId); if (acc.isFailure) return Result.failure(acc.error);`
> lecture → idem avec `requireMember`. (Le code d'erreur devient NOT_GROUP_EDITOR / NOT_GROUP_MEMBER au
> lieu de CAMPAIGN_ACCESS_DENIED — ajuster les tests en conséquence.)

- [ ] **Step 1 : Tests d'échec** — pour chaque opération : éditeur (ADMIN/MJ) peut créer/modifier/supprimer ; MEMBER ne peut PAS écrire (NOT_GROUP_EDITOR) mais PEUT lire (get/list réussissent). (Adapter aux fakes/seed existants ; le seed doit créer un membership de rôle voulu dans le groupe de la campagne.)
- [ ] **Step 2 : Lancer, vérifier l'échec** — `npx vitest run tests/application` (cibler les fichiers session)
- [ ] **Step 3 : Implémenter** — injecter `groupAccessService` dans les 5 use cases + wiring `buildSessionController` + `main.ts` ; remplacer les checks.
- [ ] **Step 4 : Suite complète + build + lint** — `npx vitest run tests/application && npm run build && npm run lint`. Ajuster tous les tests session (et tout test d'intégration session) qui supposaient le critère gameMaster.
- [ ] **Step 5 : Commit** — `git commit -m "feat(session): autorisation des sessions par rôle de groupe (édition éditeurs, lecture membres)"`

---

### Task A5 : Édition/suppression de fiche = propriétaire OU éditeur de groupe

**Files:**
- Modify: `src/application/features/character-sheet/usecases/UpdateCharacterSheetUseCaseImpl.ts:82-92` (remplacer le check MJ-de-campagne)
- Modify: le use case de suppression `DeleteCharacterSheetUseCaseImpl.ts` (même règle)
- Test: `tests/application/UpdateCharacterSheetUseCase.test.ts` (+ delete)

**Interfaces:**
- Consumes: `GroupAccessService.requireEditor`. **La fiche porte son `groupId`** : `CharacterSheet` expose un getter `groupId` (`src/domain/features/character-sheet/entities/CharacterSheet.ts:160`) et `belongsToGroup(groupId)` (ligne 211). Le check utilise donc directement `sheet.groupId`.

> NOTE clé : la règle devient « propriétaire OU éditeur du **groupe de la fiche** » :
> `const canEdit = sheet.isOwnedBy(command.ownerId) || (await this.groupAccessService.requireEditor(command.ownerId, sheet.groupId)).isSuccess;`
> Pour Update : remplace le bloc `isGameMasterOfSheetCampaign` (lignes 82-92). Pour Delete
> (`DeleteCharacterSheetUseCaseImpl.ts:32`, qui fait aujourd'hui `if (!sheet.isOwnedBy(command.ownerId))`) :
> remplacer par le même `canEdit` propriétaire-ou-éditeur. `DeleteCharacterSheet` doit recevoir le
> `groupAccessService` en dépendance (l'ajouter à son constructeur + au wiring si absent).

- [ ] **Step 1 : Écrire les tests d'échec**

```typescript
// propriétaire peut éditer
// ADMIN/MJ du groupe peut éditer une fiche dont il n'est pas propriétaire
// MEMBER non-propriétaire ne peut PAS éditer -> CHARACTER_SHEET_ACCESS_DENIED
```
(Écrire 3 cas concrets en suivant les fakes/seed du fichier existant — fiche appartenant à u-owner ; acteur u-mj éditeur ; acteur u-mem MEMBER non propriétaire.)

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run tests/application/UpdateCharacterSheetUseCase.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Implémenter le nouveau check**

Remplacer le bloc `canEdit` (lignes ~82-92) par la règle propriétaire OU éditeur du groupe de la fiche. Garder `CharacterSheetAccessDeniedError` comme erreur de refus. Faire de même dans le use case de suppression.

- [ ] **Step 4 : Lancer, vérifier le succès + non-régression**

Run: `npx vitest run tests/application`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(sheet): édition/suppression fiche = propriétaire ou éditeur du groupe"
```

---

### Task A6 : `ChangeMemberRole` accepte MJ

**Files:**
- Test: `tests/application/ChangeMemberRoleUseCase.test.ts` (ajouter cas promotion en MJ)

**Interfaces:**
- Consumes: `GroupRole.create("MJ")` (Task A1). Le use case `ChangeMemberRoleUseCaseImpl` valide déjà via `tryCreateValueObject(() => GroupRole.create(...))`, donc MJ est accepté automatiquement — il ne reste qu'à le couvrir par un test.

- [ ] **Step 1 : Ajouter le test**

```typescript
it("promeut un membre en MJ", async () => {
  repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
  repos.groupMembers.seed(buildTestMembership({ userId: "user-2", role: GroupRole.MEMBER }));
  const result = await useCase.execute({ groupId: "group-1", actorId: "user-1", targetUserId: "user-2", newRole: "MJ" });
  expect(result.isSuccess).toBe(true);
  const updated = await repos.groupMembers.findByUserIdAndGroupId("user-2", "group-1");
  expect(updated?.role.value).toBe("MJ");
});
```

- [ ] **Step 2 : Lancer**

Run: `npx vitest run tests/application/ChangeMemberRoleUseCase.test.ts`
Expected: PASS directement (le code accepte déjà MJ via GroupRole.create).

- [ ] **Step 3 : Commit**

```bash
git add tests/application/ChangeMemberRoleUseCase.test.ts
git commit -m "test(group): couvrir la promotion en MJ"
```

---

### Task A7 : `ChangeEmailUseCase` (PATCH /me/email)

**Files:**
- Create: `src/application/features/auth/abstractions/usecases/ChangeEmailUseCase.ts`
- Create: `src/application/features/auth/commands/ChangeEmailCommand.ts`
- Create: `src/application/features/auth/usecases/ChangeEmailUseCaseImpl.ts`
- Create: `src/application/features/auth/errors/EmailAlreadyUsedError.ts` (si absent — vérifier `EmailAlreadyUsed` côté register)
- Modify: `src/application/features/auth/abstractions/repositories/CredentialRepository.ts` (ajouter `updateEmail`)
- Modify: `src/infrastructure/persistence/mysql/features/auth/repository/MysqlCredentialRepository.ts` + DAO (impl `updateEmail`)
- Modify: `src/domain/features/auth/entities/Credential.ts` (méthode `withEmail(email: Email): Credential`)
- Test: `tests/application/ChangeEmailUseCase.test.ts`

**Interfaces:**
- Consumes: `Email.create`, `credentialRepository.findByUserId`, `credentialRepository.existsByEmail`, `unitOfWork`.
- Produces: `ChangeEmailUseCase.execute({ userId, newEmail }): Promise<Result<void, AppError>>`. Codes : `INVALID_EMAIL` (400), `EMAIL_ALREADY_USED` (409), `CREDENTIAL_NOT_FOUND` (404 — réutiliser un existant si présent, sinon créer).

- [ ] **Step 1 : Test d'échec**

```typescript
// tests/application/ChangeEmailUseCase.test.ts
// - change l'email d'un credential existant -> succès, repo.findByUserId reflète le nouvel email
// - email malformé -> INVALID_EMAIL
// - email déjà pris par un AUTRE compte -> EMAIL_ALREADY_USED
```
(Utiliser `FakeCredentialRepository` ; seed un Credential — réutiliser le helper de création de Credential des fakes ; en créer un si absent.)

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run tests/application/ChangeEmailUseCase.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Implémenter** — interface, command, impl :

```typescript
// ChangeEmailUseCaseImpl.ts (cœur)
const newEmailResult = tryCreateValueObject(() => Email.create(command.newEmail));
if (newEmailResult.isFailure) return Result.failure(newEmailResult.error);
const newEmail = newEmailResult.value;

const credential = await this.credentialRepository.findByUserId(command.userId);
if (credential === null) return Result.failure(new CredentialNotFoundError());

if (!credential.email.equals(newEmail) && (await this.credentialRepository.existsByEmail(newEmail))) {
  return Result.failure(new EmailAlreadyUsedError());
}

const updated = credential.withEmail(newEmail);
await this.unitOfWork.execute(async (repos) => { await repos.credentials.updateEmail(updated); });
return Result.success(undefined);
```
Ajouter `Credential.withEmail`, `CredentialRepository.updateEmail`, l'impl DAO (UPDATE de la colonne `email`), et l'erreur `EmailAlreadyUsedError` (réutiliser celle de register si elle existe).

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `npx vitest run tests/application/ChangeEmailUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(auth): use case de changement d'email"
```

---

### Task A8 : `ChangePasswordUseCase` (PATCH /me/password)

**Files:**
- Create: interface/command/impl sous `auth/...` (miroir de A7)
- Modify: `CredentialRepository` + DAO (ajouter `updatePassword`)
- Modify: `Credential.ts` (méthode `withPassword(hashed: HashedPassword): Credential`)
- Test: `tests/application/ChangePasswordUseCase.test.ts`

**Interfaces:**
- Consumes: `passwordHasher.compare`, `passwordHasher.hash`, `PlainPassword.create`, `HashedPassword.fromHash`, `credential.verifyPassword`.
- Produces: `ChangePasswordUseCase.execute({ userId, currentPassword, newPassword }): Promise<Result<void, AppError>>`. Codes : `INVALID_CREDENTIALS` (401, ancien mot de passe faux), `WEAK_PASSWORD` (400, nouveau trop faible).

- [ ] **Step 1 : Test d'échec**

```typescript
// - bon mot de passe actuel + nouveau valide -> succès, le hash stocké change
// - mauvais mot de passe actuel -> INVALID_CREDENTIALS
// - nouveau mot de passe trop faible -> WEAK_PASSWORD (code de PlainPassword)
```
(Mocker `PasswordHasherService` : `compare` retourne true/false selon le test ; `hash` retourne un hash factice.)

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run tests/application/ChangePasswordUseCase.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Implémenter**

```typescript
const credential = await this.credentialRepository.findByUserId(command.userId);
if (credential === null) return Result.failure(new CredentialNotFoundError());

const matches = await credential.verifyPassword(command.currentPassword, (p, h) => this.passwordHasher.compare(p, h));
if (!matches) return Result.failure(new InvalidCredentialsError());

const newPlainResult = tryCreateValueObject(() => PlainPassword.create(command.newPassword));
if (newPlainResult.isFailure) return Result.failure(newPlainResult.error);

const hash = await this.passwordHasher.hash(newPlainResult.value.value);
const updated = credential.withPassword(HashedPassword.fromHash(hash));
await this.unitOfWork.execute(async (repos) => { await repos.credentials.updatePassword(updated); });
return Result.success(undefined);
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `npx vitest run tests/application/ChangePasswordUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(auth): use case de changement de mot de passe"
```

---

### Task A9 : Étendre `/me` avec `PATCH /email` et `PATCH /password`

**État vérifié :** `/me` existe DÉJÀ. `UserController` (`src/presentation/http/features/auth/controllers/UserController.ts`) a la méthode `me` et reçoit `getCurrentUser` en dépendance. `buildUserRoutes` (`src/presentation/http/features/auth/routes/userRoutes.ts`) déclare `router.get("/", controller.me)`. Montage : `main.ts:286` `app.use("/me", authMiddleware, buildUserRoutes(controllers.user))`. `controllers.user` est construit `main.ts:374` `new UserController(new GetCurrentUserUseCaseImpl(...))`. **On ÉTEND ces fichiers existants — PAS de nouveau dossier `features/user`.**

**Files:**
- Modify: `src/presentation/http/features/auth/controllers/UserController.ts` (ajouter `changeEmail`, `changePassword` + les 2 use cases au constructeur ; mapper les erreurs inline comme `me` le fait : EMAIL_ALREADY_USED→409, INVALID_CREDENTIALS→401, INVALID_EMAIL/WEAK_PASSWORD/défaut→400, USER_NOT_FOUND→401)
- Modify: `src/presentation/http/features/auth/routes/userRoutes.ts` (`router.patch("/email", controller.changeEmail)`, `router.patch("/password", controller.changePassword)`)
- Modify: `src/main.ts` (passer `ChangeEmailUseCaseImpl` et `ChangePasswordUseCaseImpl` au `new UserController(...)`, construits sur `services.credentialRepository`, le password hasher de `services`, `services.unitOfWork`)
- Test: `tests/presentation/userRoutes.integration.test.ts` (intégration HTTP — supertest, `test:db`)

**Interfaces:**
- Consumes: `ChangeEmailUseCase`/`Impl`, `ChangePasswordUseCase`/`Impl` (A7/A8), `authMiddleware` (req.user.userId).

> NE PAS casser `GET /me`. Réutiliser le style de mapping inline de `me` (pas de nouveau UserHttpMapper).

- [ ] **Step 1 : Test d'intégration d'échec** (supertest) — register+login, puis `PATCH /me/email` change l'email, `PATCH /me/password` avec mauvais ancien → 401, etc. (Suivre le pattern de `tests/presentation/*.integration.test.ts`. Ces tests tournent en `test:db` — les marquer en conséquence ou réutiliser le harness d'intégration HTTP existant.)

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run tests/presentation/userRoutes.integration.test.ts`
Expected: FAIL (routes absentes → 404).

- [ ] **Step 3 : Implémenter controller + routes + mapper + factory + montage** (suivre exactement le pattern `AuthController`/`authRoutes`/`buildAuthController`).

- [ ] **Step 4 : Lancer, vérifier le succès + build + lint**

Run: `npx vitest run tests/presentation/userRoutes.integration.test.ts && npm run lint && npm run build`
Expected: PASS / 0 warning / build OK.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(user): endpoints PATCH /me/email et /me/password"
```

---

### Task A10 : Confirmer que la colonne `role` accepte `MJ` (aucune migration)

**Files:**
- Inspect: `src/infrastructure/persistence/drizzle/schema/friend-group.schema.ts` (confirmer que `role` est `varchar`, pas un `enum`)
- Modify: `db/MIGRATION.md` OU `README.md` (note brève : le rôle `MJ` est une valeur applicative valide de la colonne libre `group_members.role`, aucune migration nécessaire)

**Interfaces:**
- Produces: rien de schéma (décision pré-flight : pas de migration no-op). Juste une note de doc.

> NOTE (décision pré-flight) : `role` est un `varchar(10)` **libre** (pas un `ENUM` MySQL), donc
> insérer `"MJ"` ne nécessite AUCUN DDL et AUCUNE migration. On NE crée PAS de migration no-op
> (un fichier vide serait du bruit). Cette tâche se limite à : (1) confirmer le type en lisant le
> schéma, (2) ajouter une courte note de documentation. **Exception** : si la lecture révèle que
> `role` est en réalité un `enum(...)`, alors créer une vraie migration
> `ALTER TABLE group_members MODIFY role ...` ajoutant `MJ` — décision prise à la lecture.

- [ ] **Step 1 : Lire le schéma** et confirmer le type de `role`.

Run: `grep -n "role" src/infrastructure/persistence/drizzle/schema/friend-group.schema.ts`
Expected: `role: varchar("role", { length: 10 })` → aucune migration requise.

- [ ] **Step 2 : Ajouter une note de doc** (dans `db/MIGRATION.md`, section appropriée) :

```markdown
> **Rôle de groupe `MJ`** — La colonne `group_members.role` est un `varchar` libre : les valeurs
> de rôle (`ADMIN`, `MJ`, `MEMBER`) sont validées au niveau applicatif (`GroupRole`), pas par une
> contrainte SQL. Ajouter un rôle ne nécessite donc aucune migration.
```

- [ ] **Step 3 : Commit**

```bash
git add db/MIGRATION.md
git commit -m "docs(db): noter que le rôle MJ ne requiert aucune migration (colonne role libre)"
```

---

## PHASE B — FRONTEND

### Task B1 : `ActiveGroupState` expose le rôle du groupe actif + `canEdit`

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/presentation/features/friendgroup/ActiveGroupState.kt`
- Modify: `src/main/kotlin/eu/ejdr/di/FriendGroupModule.kt` (passer `GetGroupUseCase` à `ActiveGroupState`)
- Test: `src/test/kotlin/eu/ejdr/presentation/features/friendgroup/ActiveGroupStateTest.kt` (créer)

**Interfaces:**
- Consumes: `GetGroupUseCase(groupId): Result<FriendGroupDetail, FriendGroupError>` (existant), `FriendGroupDetail.myRole: String`.
- Produces: `ActiveGroupState.activeGroupRole: StateFlow<String?>` ; `activeGroupId: StateFlow<String?>` (inchangé) ; `canEdit: StateFlow<Boolean>` (true si role ∈ {ADMIN, MJ}). À l'appel de `select(id)`, recharger le rôle via `GetGroupUseCase` ; `select(null)` remet rôle à null.

- [ ] **Step 1 : Test d'échec**

```kotlin
// ActiveGroupStateTest.kt
// - select("g1") avec GetGroupUseCase renvoyant myRole="MJ" -> activeGroupRole.value == "MJ", canEdit.value == true
// - select("g1") myRole="MEMBER" -> canEdit.value == false
// - select(null) -> activeGroupRole.value == null, canEdit.value == false
// (mocker GetGroupUseCase avec MockK ; piloter le scope via un dispatcher de test)
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `./gradlew test --tests "*ActiveGroupStateTest*"`
Expected: FAIL (compilation : `activeGroupRole`/`canEdit` n'existent pas).

- [ ] **Step 3 : Implémenter**

Ajouter `getGroup: GetGroupUseCase` au constructeur. Ajouter :
```kotlin
private val _activeGroupRole = MutableStateFlow<String?>(null)
val activeGroupRole: StateFlow<String?> = _activeGroupRole.asStateFlow()

val canEdit: StateFlow<Boolean> = activeGroupRole
    .map { it == "ADMIN" || it == "MJ" }
    .stateIn(scope, SharingStarted.Eagerly, false)
```
Dans `init` et `select`, après avoir fixé `activeGroupId`, charger le rôle : si id != null → `getGroup(id)` ; en cas de succès `_activeGroupRole.value = detail.myRole`, sinon `null`. Si id == null → `_activeGroupRole.value = null`.
Mettre à jour `FriendGroupModule` : `single { ActiveGroupState(get(), get(), get()) }` (ajout `GetGroupUseCase`).

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `./gradlew test --tests "*ActiveGroupStateTest*"`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(group): exposer le rôle du groupe actif et canEdit"
```

---

### Task B2 : Gating de navigation — cacher Formations/Fiches/Campagnes sans groupe actif

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/presentation/features/user/UserNavEntries.kt` (observer `activeGroupId`, passer `null` aux 3 callbacks si pas de groupe)
- Test: couverture via `run` (UI) — pas de test unitaire de composable ; vérifier manuellement.

**Interfaces:**
- Consumes: `ActiveGroupState.activeGroupId` (existant).

- [ ] **Step 1 : Implémenter le gating**

Dans `userEntries`, injecter `ActiveGroupState` (via `koinInject`), observer `activeGroupId`, et conditionner :
```kotlin
val activeGroupState = koinInject<ActiveGroupState>()
val groupId by activeGroupState.activeGroupId.collectAsStateWithLifecycle()
AppTopBar(
    title = "E-JDR",
    onLogout = actions.onLogout,
    onCampaigns = groupId?.let { { actions.backStack.add(Route.Campaigns) } },
    onCharacterSheets = groupId?.let { { actions.backStack.add(Route.CharacterSheets) } },
    onReferences = groupId?.let { { actions.backStack.add(Route.ReferenceHub) } },
    onGroups = { actions.backStack.add(Route.Groups) },
    onInvitations = { actions.backStack.add(Route.Invitations) },
    onSettings = { actions.backStack.add(Route.Settings) },
)
```
(Vérifier que `koinInject`/`collectAsStateWithLifecycle` sont importables dans ce fichier — sinon suivre l'import des pages qui les utilisent.)

- [ ] **Step 2 : Vérifier compilation + detekt**

Run: `./gradlew compileKotlin detekt`
Expected: OK.

- [ ] **Step 3 : Vérifier visuellement** via `./gradlew run` : sans groupe actif, les 3 boutons sont absents ; après activation d'un groupe, ils apparaissent.

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "feat(nav): masquer Formations/Fiches/Campagnes tant qu'aucun groupe actif"
```

---

### Task B3 : Méthodes repository + use cases front `changeEmail`/`changePassword`

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/application/features/auth/abstraction/repository/AuthRepository.kt`
- Modify: `src/main/kotlin/eu/ejdr/infrastructure/http/features/auth/AuthHttpRepository.kt` (+ DTOs + mapper d'erreurs)
- Modify: `src/main/kotlin/eu/ejdr/domain/features/auth/error/AuthError.kt` (ajouter `EmailAlreadyUsed` si absent — il existe ; ajouter `WeakPassword`)
- Modify: `src/main/kotlin/eu/ejdr/infrastructure/http/features/auth/AuthHttpMapper.kt` (codes WEAK_PASSWORD, INVALID_EMAIL, EMAIL_ALREADY_USED)
- Create: `ChangeEmailUseCase(.kt)` + `ChangePasswordUseCase(.kt)` + impls
- Modify: `src/main/kotlin/eu/ejdr/di/AuthModule.kt`
- Test: `src/test/kotlin/eu/ejdr/infrastructure/http/features/auth/AuthHttpRepositoryTest.kt` (ajouter cas changeEmail/changePassword via MockEngine)

**Interfaces:**
- Produces:
  - `AuthRepository.changeEmail(newEmail: String): Result<Unit, AuthError>`
  - `AuthRepository.changePassword(currentPassword: String, newPassword: String): Result<Unit, AuthError>`
  - `ChangeEmailUseCase`/`ChangePasswordUseCase` (fun interfaces) déléguant au repo.

- [ ] **Step 1 : Test d'échec** (MockEngine) — `PATCH /me/email` 200 → Success ; 409 code EMAIL_ALREADY_USED → Failure(EmailAlreadyUsed) ; `PATCH /me/password` 401 INVALID_CREDENTIALS → Failure(InvalidCredentials) ; 400 WEAK_PASSWORD → Failure(WeakPassword).

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `./gradlew test --tests "*AuthHttpRepositoryTest*"`
Expected: FAIL.

- [ ] **Step 3 : Implémenter** : ajouter à `AuthError` `data object WeakPassword`, mapper les codes, ajouter les 2 méthodes au repo + impl HTTP (suivre `authenticate` : `client.patch("${config.baseUrl}/me/email") { setBody(ChangeEmailRequestDto(newEmail)) }`, `runCatchingCancellable`, `getOrElse { Result.Failure(AuthError.Network) }`), les DTOs, et les 4 fichiers use case + le wiring Koin.

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `./gradlew test --tests "*AuthHttpRepositoryTest*"`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(auth): changeEmail/changePassword (repository + use cases)"
```

---

### Task B4 : Page profil — afficher email, dialogs changer email/mot de passe, déconnexion

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/presentation/features/user/UserViewModel.kt` (ajouter actions + états)
- Modify: `src/main/kotlin/eu/ejdr/presentation/features/user/page/UserPage.kt` (boutons + dialogs + déconnexion)
- Create: `ChangeEmailDialog.kt`, `ChangePasswordDialog.kt` (réutiliser `AppDialog` + `AppTextField` + `FormError`)
- Modify: `src/main/kotlin/eu/ejdr/presentation/features/user/UserNavEntries.kt` (passer `onLogout` à `UserPage`)
- Modify: `build.gradle.kts` Kover si la page user est exclue (vérifier — le VM doit rester compté)
- Test: `src/test/kotlin/eu/ejdr/presentation/features/user/UserViewModelTest.kt` (logique VM : succès/erreur des deux actions)

**Interfaces:**
- Consumes: `ChangeEmailUseCase`, `ChangePasswordUseCase` (B3), `LogoutUseCase` (existant, via NavActions).
- Produces: `UserViewModel.changeEmail(newEmail)`, `changePassword(current, new)`, états `emailState`/`passwordState` (Idle/Loading/Error(msg)/Success) ou équivalent ; `UserPage(onSessionExpired, onLogout, ...)`.

- [ ] **Step 1 : Test d'échec (VM)**

```kotlin
// UserViewModelTest.kt
// - changeEmail succès -> état Success, profile reflète le nouvel email (recharger via me() ou maj locale)
// - changeEmail EmailAlreadyUsed -> état Error avec message
// - changePassword InvalidCredentials -> état Error
// (mocker les use cases avec MockK)
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `./gradlew test --tests "*UserViewModelTest*"`
Expected: FAIL.

- [ ] **Step 3 : Implémenter** le VM (actions + StateFlows d'état par action), puis `UserPage` (afficher email, 3 boutons : Changer d'email / Changer le mot de passe / Déconnexion, ouvrant les dialogs / déclenchant `onLogout`), et les 2 dialogs. Brancher `onLogout = actions.onLogout` dans `UserNavEntries`.

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `./gradlew test --tests "*UserViewModelTest*"`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(user): page profil (changer email/mot de passe + déconnexion)"
```

---

### Task B5 : Retirer la déconnexion du header partagé

**Files:**
- Modify: `src/main/kotlin/eu/ejdr/presentation/shared/component/organism/AppTopBar.kt` (retirer le bouton « Déconnexion » et, si plus utilisé ailleurs, le paramètre `onLogout`)
- Modify: tous les appelants d'`AppTopBar` qui passaient `onLogout` (grep `onLogout` dans presentation/)

**Interfaces:**
- Le bouton déconnexion vit désormais uniquement sur `UserPage` (B4).

> NOTE : `onLogout` est un paramètre **non-nullable** d'`AppTopBar` aujourd'hui, passé par plusieurs NavEntries. Décider : soit le rendre optionnel/supprimé et nettoyer tous les appelants, soit garder la signature mais ne plus rendre le bouton. Le plus propre : supprimer le paramètre et nettoyer les appelants. Vérifier par grep `AppTopBar(` et `onLogout`.

- [ ] **Step 1 : Recenser les appelants**

Run: `grep -rn "onLogout\|AppTopBar(" src/main/kotlin/eu/ejdr/presentation`

- [ ] **Step 2 : Retirer le bouton + le paramètre** d'`AppTopBar`, nettoyer chaque appelant.

- [ ] **Step 3 : Vérifier compilation + detekt**

Run: `./gradlew compileKotlin detekt`
Expected: OK (aucune référence orpheline à `onLogout`).

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "refactor(nav): déplacer la déconnexion du header vers la page profil"
```

---

### Task B6 — découpée en B6a / B6b / B6c (voir ci-dessous)

> Cartographie : ActiveGroupState.canEdit attend déjà ADMIN/MJ. Écrans à gater :
> Reference list (FAB + card edit/delete), Campaign list (FAB + card delete), Campaign detail
> (boutons rattacher/ajouter session — n'injecte PAS encore ActiveGroupState), MyCharacterSheets
> (FAB à GARDER), CharacterSheetDetail (bouton Modifier = canEdit OU propriétaire — nécessite l'ID
> user courant, pas encore dans le VM detail), GroupDetail/MemberCard (toggle ADMIN↔MEMBER → choix
> 3 états ADMIN/MJ/MEMBER). Découpe en 3 sous-tâches indépendantes.

#### Task B6a : lecture seule catalogues + campagnes (liste & détail)
- ReferenceListPage : `canEdit` via `koinInject<ActiveGroupState>().canEdit.collectAsStateWithLifecycle()` ; FAB création masqué si `!canEdit` ; les `onEdit`/`onDelete` des ReferenceCard ne sont rendus que si canEdit (rendre les callbacks nullables dans `ReferenceCard` comme `CharacterSheetCard` le fait déjà : `if (onDelete != null)`).
- CampaignListPage : FAB masqué si `!canEdit` ; bouton delete de `CampaignCard` rendu seulement si canEdit (callback nullable).
- CampaignDetailPage : injecter `ActiveGroupState`, observer `canEdit`, masquer les boutons « Rattacher une fiche » et « Ajouter une session » si `!canEdit`.
- Compile + detekt + commit. Vérif visuelle différée.

#### Task B6b : fiches — FAB conservé + détail (canEdit OU propriétaire)
- MyCharacterSheetsPage : le FAB de création RESTE visible (un MEMBER crée ses fiches). Le bouton delete de `CharacterSheetCard` : visible si `canEdit OU ownerId == currentUserId` (la carte a déjà un `onDelete` nullable). Il faut l'id du user courant — voir ci-dessous.
- CharacterSheetDetailPage : bouton « Modifier » visible si `canEdit OU sheet.ownerId == currentUserId`. Le VM detail doit exposer l'id du user courant : injecter `GetCurrentUserUseCase` dans `CharacterSheetDetailViewModel` (ou exposer un `canEditSheet: StateFlow<Boolean>` calculé). Le plus propre : ajouter au VM un `currentUserId` chargé en init via `GetCurrentUserUseCase`, et exposer `isOwner = sheet.ownerId == currentUserId` ; la page combine `canEdit || isOwner`.
- Test : si on ajoute de la logique au `CharacterSheetDetailViewModel` (currentUserId/isOwner), couvrir par un test VM (le VM est compté par Kover). Sinon (logique seulement dans le composable), pas de test.
- Compile + detekt (+ test VM si logique VM) + commit.

#### Task B6c : UI rôle MJ dans la gestion des membres
- `MemberCard` (FriendGroupComponents.kt) : remplacer le toggle ADMIN↔MEMBER par un choix à 3 rôles (ADMIN / MJ / MEMBER). Option simple : un petit menu/`DropdownMenu` ou un dialog listant les 3 rôles, appelant `onChangeRole(role)` avec le rôle choisi (≠ rôle courant). Garder la protection « dernier admin » existante (ne pas permettre de rétrograder le dernier admin — déjà géré via `canManageRole`/`wouldDemoteLastAdmin` côté page).
- Compile + detekt + commit. Vérif visuelle différée.

### Task B6 (référence d'origine, remplacée par B6a/b/c)

**Files:**
- Modify: `ReferenceListPage.kt` (FAB création + onEdit/onDelete des cartes conditionnés par `canEdit`)
- Modify: `CampaignListPage.kt` (FAB création + suppression conditionnés)
- Modify: `CampaignDetailPage.kt` (actions d'édition conditionnées)
- Modify: `CharacterSheetDetailPage.kt` (bouton « Modifier » visible si `canEdit` OU propriétaire de la fiche)
- Modify: `MyCharacterSheetsPage.kt` (FAB création — un MEMBER peut créer SES fiches, donc le FAB reste ; mais l'édition d'une fiche d'autrui est masquée dans le détail)
- Modify: la page détail de groupe (`GroupDetailPage.kt`) : ajouter `MJ` aux choix de rôle dans `MemberCard`/changeRole
- Test: vérification visuelle via `run` (composables) ; logique de décision `canEdit` déjà testée en B1.

**Interfaces:**
- Consumes: `ActiveGroupState.canEdit: StateFlow<Boolean>` (B1) injecté dans chaque page via `koinInject<ActiveGroupState>()`.
- Règle fiches : `canEditSheet = canEdit || sheet.ownerId == currentUserId`. (Le `currentUserId` est disponible via le profil/session — vérifier comment l'obtenir dans la page détail ; sinon exposer via le VM.)

- [ ] **Step 1 : Catalogues** — dans `ReferenceListPage`, observer `canEdit` ; masquer le FAB si `!canEdit` ; ne passer `onEdit`/`onDelete` aux `ReferenceCard` que si `canEdit` (sinon rendre une variante sans icônes — adapter `ReferenceCard` pour rendre les icônes conditionnelles, ex. callbacks nullables). Compiler + detekt.

- [ ] **Step 2 : Campagnes** — `CampaignListPage` (FAB + delete) et `CampaignDetailPage` (actions d'édition) conditionnés par `canEdit`. Compiler + detekt.

- [ ] **Step 3 : Fiches** — `CharacterSheetDetailPage` : bouton « Modifier » affiché si `canEdit || estProprietaire`. `MyCharacterSheetsPage` : FAB de création conservé (MEMBER crée les siennes). Compiler + detekt.

- [ ] **Step 4 : Rôle MJ dans l'UI groupe** — `GroupDetailPage`/`MemberCard` : ajouter `MJ` à la liste des rôles attribuables (ADMIN/MJ/MEMBER). Compiler + detekt.

- [ ] **Step 5 : Vérification visuelle** via `./gradlew run` avec un compte MEMBER (lecture seule) puis MJ/ADMIN (édition) sur le back de dev.

- [ ] **Step 6 : `./gradlew verify`**

Run: `./gradlew verify`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat(acl): lecture seule pour les MEMBER, édition pour ADMIN/MJ (UI)"
```

---

## Vérification finale (les deux repos)

- [ ] Back : `npm run lint && npm run build && npx vitest run` → tout vert.
- [ ] Front : `./gradlew verify` → BUILD SUCCESSFUL.
- [ ] Migration appliquée d'abord sur le back de DEV (Vertex) — vérifier `migrations applied successfully` + serveur sain, AVANT la prod.
- [ ] Test runtime end-to-end (front dev contre back dev) : compte MEMBER en lecture seule, MJ/ADMIN en édition, gating nav sans groupe actif, changement email/mot de passe.

## Décisions différées / hors plan

- Invalidation de session après changement de mot de passe : hors périmètre (rester connecté).
- Dérivation auto du rôle MJ depuis les campagnes : non retenue (attribution manuelle par ADMIN).
