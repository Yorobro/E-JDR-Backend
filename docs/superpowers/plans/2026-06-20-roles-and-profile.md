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

### Task A4 : Brancher `requireEditor` sur campagnes & sessions

**Files:**
- Modify: `src/application/features/campaign/usecases/CreateCampaignUseCaseImpl.ts` (et tout use case d'édition campagne utilisant `requireMember` pour une action d'écriture)
- Modify: les use cases de session (création/édition) si présents sous `src/application/features/session/usecases/`
- Test: `tests/application/CreateCampaignUseCase.test.ts` (+ tests session correspondants)

**Interfaces:**
- Consumes: `GroupAccessService.requireEditor`.

> NOTE implémentation : repérer par grep les use cases d'ÉCRITURE (create/update/delete) qui appellent `requireMember`. Seuls ceux-là passent à `requireEditor`. Les use cases de LECTURE (list/get) gardent `requireMember`.

- [ ] **Step 1 : Écrire les tests d'échec** (campagne)

```typescript
it("refuse un MEMBER de créer une campagne (NOT_GROUP_EDITOR)", async () => {
  // seed u-mem MEMBER de group-1 (suivre le pattern existant du fichier)
  const result = await useCase.execute({ /* groupId group-1, createdBy u-mem, name … */ });
  expect(result.isFailure).toBe(true);
  expect(result.error.code).toBe("NOT_GROUP_EDITOR");
});
it("autorise un MJ à créer une campagne", async () => {
  const result = await useCase.execute({ /* MJ */ });
  expect(result.isSuccess).toBe(true);
});
```
(Adapter aux arguments réels de `CreateCampaignCommand` lus dans le fichier de test existant.)

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run tests/application/CreateCampaignUseCase.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Remplacer `requireMember` → `requireEditor`** dans les use cases d'écriture campagne/session repérés.

- [ ] **Step 4 : Lancer la suite ciblée + vérifier les régressions**

Run: `npx vitest run tests/application` 
Expected: PASS (corriger les tests existants qui supposaient qu'un MEMBER pouvait créer une campagne/session — les ajuster pour utiliser un ADMIN/MJ).

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(campaign): création/édition campagnes et sessions réservée aux éditeurs"
```

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

### Task A9 : Routes + controller `/me` (email + password) + montage + mapping HTTP

**Files:**
- Create: `src/presentation/http/features/user/controllers/UserController.ts` (méthodes `changeEmail`, `changePassword`)
- Create: `src/presentation/http/features/user/routes/userRoutes.ts` (`PATCH /email`, `PATCH /password`)
- Create: `src/presentation/http/features/user/mappers/UserHttpMapper.ts` (code → statut : EMAIL_ALREADY_USED→409, INVALID_EMAIL→400, INVALID_CREDENTIALS→401, WEAK_PASSWORD→400, défaut 400)
- Create: `src/presentation/http/features/user/buildUserController.ts` (factory)
- Modify: `src/main.ts` (instancier le UserController et monter `app.use("/me", authMiddleware, buildUserRoutes(...))`)
- Test: `tests/presentation/userRoutes.integration.test.ts` (intégration HTTP — supertest)

**Interfaces:**
- Consumes: `ChangeEmailUseCase`, `ChangePasswordUseCase` (A7/A8), `authMiddleware` (req.user.userId).

> NOTE : vérifier qu'aucune route `/me` n'existe déjà (le front utilise `GET /me` pour le profil ; voir comment elle est montée aujourd'hui — peut-être via auth). Ne PAS casser le `GET /me` existant : monter les nouvelles routes sur le même préfixe ou compléter le routeur existant.

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

### Task A10 : Migration BDD — élargir la colonne `role` à `MJ`

**Files:**
- Inspect: `src/infrastructure/persistence/drizzle/schema/friend-group.schema.ts` (la colonne `role` est `varchar(10)` — `MJ` y entre déjà, longueur OK)
- Create: migration custom documentaire (le schéma TS ne change pas, donc `db:generate` ne produira rien) — utiliser `npm run db:custom -- --name=allow_mj_role` pour poser un fichier qui **documente** l'extension de domaine de valeurs (la colonne acceptant déjà la chaîne, aucune contrainte SQL à modifier).
- Modify: `db/MIGRATION.md` si une note est utile.

**Interfaces:**
- Produces: une entrée de migration appliquée (`__drizzle_migrations`) traçant l'ajout du rôle MJ.

> NOTE importante : comme `role` est un `varchar(10)` libre (pas un `ENUM` MySQL), insérer `"MJ"` ne nécessite AUCUN DDL. Cette tâche existe pour (a) confirmer ce fait en lisant le schéma, (b) poser une migration custom no-op documentée pour la traçabilité. Si en lisant le schéma on découvre que `role` est en réalité un `enum(...)`, alors écrire un `ALTER TABLE group_members MODIFY role ...` ajoutant `MJ` — décision prise à la lecture.

- [ ] **Step 1 : Lire le schéma** et confirmer le type de `role`.

Run: `grep -n "role" src/infrastructure/persistence/drizzle/schema/friend-group.schema.ts`
Expected: `role: varchar("role", { length: 10 })` → aucun DDL requis.

- [ ] **Step 2 : Créer la migration custom**

Run: `npm run db:custom -- --name=allow_mj_role`
Puis écrire dans le `.sql` généré un commentaire SQL explicatif (no-op) :
```sql
-- Le rôle de groupe `MJ` est désormais une valeur applicative valide de la colonne
-- `group_members.role` (varchar). Aucune modification de schéma nécessaire (colonne libre).
SELECT 1;
```

- [ ] **Step 3 : Appliquer sur la BDD locale/dev** (si Docker dispo) ou différer à la validation Vertex dev.

Run: `npm run db:migrate` (si BDD joignable)
Expected: `migrations applied successfully`.

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "chore(db): tracer l'autorisation du rôle MJ (colonne role libre, no-op DDL)"
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

### Task B6 : Lecture seule selon `canEdit` (catalogues, campagnes, fiches) + choix de rôle MJ

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
