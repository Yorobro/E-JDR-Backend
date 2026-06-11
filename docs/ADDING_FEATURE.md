# Ajouter une feature métier — guide pas-à-pas

Ce guide suit le pattern réel du projet (voir `auth` comme référence). Remplace `<feature>` par
le nom de ta feature en snake_case (ex: `campaign`), et `Xxx`/`XxxUseCase` par le nom Pascal.

---

## 1. Domaine — `src/domain/features/<feature>/`

### Entités

Constructeur **privé**, deux factories obligatoires :

```ts
// src/domain/features/<feature>/entities/Xxx.ts
export class Xxx {
  private constructor(private readonly props: XxxSnapshot) {}

  /** Crée un nouvel objet (chemin d'écriture). */
  public static create(params: { id: string; createdAt: Date }): Xxx { ... }

  /** Reconstruit depuis un snapshot BDD (chemin lecture). */
  public static restore(snapshot: XxxSnapshot): Xxx { ... }

  // Getters uniquement — jamais de setter.
  public get id(): string { return this.props.id; }
}
```

Règles immuables :
- Aucun setter, les méthodes mutantes retournent une **nouvelle instance**.
- Les règles métier vivent dans l'entité (ex : `isLocked()`, `recordFailedAttempt()`).
- Les dépendances techniques sont **injectées** en paramètre (ex : `PasswordCompareFn`),
  jamais importées.

### Value Objects

Lèvent une `DomainError` à la construction si l'invariant est violé :

```ts
// src/domain/features/<feature>/value-objects/XxxValue.ts
export class XxxValue {
  private constructor(public readonly value: string) {}

  public static create(raw: string): XxxValue {
    if (!isValid(raw)) throw new XxxDomainError(raw);
    return new XxxValue(normalize(raw));
  }
}
```

### Erreurs domaine

```ts
// src/domain/features/<feature>/errors/XxxDomainError.ts
import { DomainError } from "@domain/shared/errors/DomainError";

export class XxxDomainError extends DomainError {
  constructor(raw: string) {
    super("INVALID_XXX", `Valeur invalide : ${raw}`);
  }
}
```

**Règle absolue** : le dossier `domain/` ne contient aucun `import` vers une lib npm,
ni vers `application/` ou `infrastructure/`.

---

## 2. Application — `src/application/features/<feature>/`

### 2a. Ports repository — `abstractions/repositories/`

```ts
// XxxRepository.ts  (sans préfixe I)
export interface XxxRepository {
  findById(id: string): Promise<Xxx | null>;
  save(entity: Xxx): Promise<void>;
}
```

### 2b. Ports service — `abstractions/services/` (si nécessaire)

```ts
export interface XxxService {
  doSomething(input: string): Promise<string>;
}
```

### 2c. Ports use case + types résultat — `abstractions/usecases/`

```ts
// XxxUseCase.ts
export interface XxxResult {
  readonly id: string;
  // ...
}

export interface XxxUseCase {
  execute(command: XxxCommand): Promise<Result<XxxResult, AppError>>;
}
```

### 2d. Commands / Queries — `commands/`

```ts
// CreateXxxCommand.ts  (objet de transfert simple, aucune logique)
export interface CreateXxxCommand {
  readonly name: string;
}
```

### 2e. Erreurs applicatives — `errors/`

```ts
// XxxNotFoundError.ts
import { AppError } from "@application/errors/AppError";

export class XxxNotFoundError extends AppError {
  constructor() {
    super("XXX_NOT_FOUND", "L'élément demandé est introuvable.");
  }
}
```

Le code (`"XXX_NOT_FOUND"`) est un identifiant **stable** : il ne change jamais, le frontend
peut le lire pour afficher un message adapté.

### 2f. Implémentations use case — `usecases/`

```ts
export class CreateXxxUseCaseImpl implements CreateXxxUseCase {
  constructor(
    private readonly xxxRepository: XxxRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: Logger,
  ) {}

  public async execute(command: CreateXxxCommand): Promise<Result<XxxResult, AppError>> {
    // 1. Valider via le domaine (capturer DomainError → AppError)
    // 2. Vérifier les règles métier (doublons, etc.)
    // 3. Créer l'entité via factory
    // 4. Écrire via unitOfWork.execute(...)
    // 5. Retourner Result.success(...)
  }
}
```

Règles clés :
- **Retourne toujours `Result<T, AppError>`**, jamais de `throw` métier.
- **Toute écriture passe par `unitOfWork.execute(...)`** (atomicité).
- **Lectures pures** : utilise le repository injecté directement (pas de UnitOfWork).
- **Jamais** d'appel use case → use case. Factoriser via un service partagé si besoin.
- Les erreurs domaine (`DomainError`) sont capturées et converties en `InvalidInputError`
  (ou une erreur applicative spécifique) avant d'être retournées.

---

## 3. Infrastructure — `src/infrastructure/persistence/mysql/features/<feature>/`

### 3a. DAO — `dao/`

SQL pur, une table par DAO, renvoie des Row (pas des entités) :

```ts
export interface XxxRow extends RowDataPacket {
  id: string;
  name: string;
  created_at: Date;
}

export class XxxDao {
  constructor(private readonly executor: SqlExecutor) {}

  public async findById(id: string): Promise<XxxRow | null> {
    const [rows] = await this.executor.execute<XxxRow[]>(
      "SELECT id, name, created_at FROM xxx WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] ?? null;
  }

  public async insert(row: { id: string; name: string; created_at: Date }): Promise<void> {
    await this.executor.execute("INSERT INTO xxx (id, name, created_at) VALUES (?, ?, ?)", [
      row.id, row.name, row.created_at,
    ]);
  }
}
```

### 3b. Mappers — `mappers/`

Conversion bidirectionnelle Row ↔ entité domaine :

```ts
export class XxxMapper {
  public static toDomain(row: XxxRow): Xxx {
    return Xxx.restore({ id: row.id, name: row.name, createdAt: row.created_at });
  }

  public static toRow(entity: Xxx): { id: string; name: string; created_at: Date } {
    return { id: entity.id, name: entity.name, created_at: entity.createdAt };
  }
}
```

### 3c. Repository — `repository/`

Assemblage DAO + Mapper, implémente le port :

```ts
export class MysqlXxxRepository implements XxxRepository {
  constructor(private readonly xxxDao: XxxDao) {}

  public async findById(id: string): Promise<Xxx | null> {
    const row = await this.xxxDao.findById(id);
    return row === null ? null : XxxMapper.toDomain(row);
  }

  public async save(entity: Xxx): Promise<void> {
    await this.xxxDao.insert(XxxMapper.toRow(entity));
  }
}
```

### 3d. Factory — `createXxxRepositories.ts`

Point unique de construction, partagé entre le composition root et le `UnitOfWork` :

```ts
export function createXxxRepositories(executor: SqlExecutor): Pick<TransactionalRepositories, 'xxx'> {
  return {
    xxx: new MysqlXxxRepository(new XxxDao(executor)),
  };
}
```

**Si le nouveau repo participe aux transactions** : enrichir l'interface `TransactionalRepositories`
dans `src/application/shared/UnitOfWork.ts` (ajouter le champ `xxx: XxxRepository`) et mettre à
jour `MysqlUnitOfWork` pour l'inclure via la factory.

---

## 4. Présentation (couche HTTP)

La couche présentation est organisée par feature. Pour chaque nouvelle feature, créer :

- **Controller** : reçoit la requête HTTP, extrait et adapte les données vers une Command/Query,
  appelle le use case via son **interface** (jamais l'implémentation concrète), puis délègue
  la réponse au mapper HTTP.
- **Routes** : monte le controller sur les routes Express correspondantes ; les middlewares
  d'authentification s'insèrent ici (avant le controller).
- **Mapper HTTP** : traduit un `Result<T, AppError>` en réponse HTTP — succès ou erreur.
  Chaque code applicatif (`AppError.code`) est mappé vers un statut HTTP précis (voir
  `CONTRAT_API.md` pour la convention). Ce mapper **ne connaît pas le domaine**, seulement
  les codes d'erreur applicatifs.

Les chemins exacts au sein de `src/presentation/` sont en cours de restructuration vers une
organisation par feature ; se référer à l'arborescence courante du repo plutôt qu'à ce guide.

---

## 5. Migration DB — `db/migrations/`

Créer un fichier `Vxxx__nom_snake_case.sql` idempotent. Voir `db/MIGRATION.md` pour :
- La convention de nommage (`Vxxx__description.sql`).
- Le pattern `information_schema` guard (ADD COLUMN / CREATE INDEX sans `IF NOT EXISTS`).
- La coordination du numéro en équipe (risque de doublon sur branches parallèles).

---

## 6. Tests

### Tests de domaine

Vérifient les invariants sans aucune dépendance :

```ts
// tests/domain/features/<feature>/Xxx.test.ts
it("ne peut pas être construit avec une valeur invalide", () => {
  expect(() => XxxValue.create("")).toThrow(XxxDomainError);
});
```

### Tests de use case (avec fakes)

Utilisent des fakes en mémoire — voir `tests/application/fakes.ts` pour le pattern existant :

```ts
// tests/application/features/<feature>/CreateXxxUseCaseImpl.test.ts
const fakeRepo = new InMemoryXxxRepository();
const useCase = new CreateXxxUseCaseImpl(fakeRepo, fakeUnitOfWork, fakeLogger);

it("retourne un Result.success si les données sont valides", async () => {
  const result = await useCase.execute({ name: "Test" });
  expect(result.isSuccess()).toBe(true);
});
```

### Tests d'intégration HTTP (supertest)

Montage de la pile réelle avec fakes injectés, requêtes HTTP via supertest :

```ts
// tests/presentation/features/<feature>/xxx.routes.test.ts
const app = buildApp({ xxxRepository: new InMemoryXxxRepository() });
const res = await request(app).post("/xxx").send({ name: "Test" });
expect(res.status).toBe(201);
```

### Tests DAO Testcontainers — `tests/db/`

Testent le SQL réel sur une vraie instance MySQL éphémère :

```bash
npm run test:db
```

Les tests Testcontainers rejouent toutes les migrations depuis zéro ; valide aussi
l'idempotence de ta nouvelle migration.

---

## 7. Wiring & DI (composition root)

Tout l'assemblage manuel se fait dans `src/main.ts` (composition root) :

1. Instancier les DAO et repositories via `createXxxRepositories(pool)`.
2. Instancier les services et use case impls en injectant les ports.
3. Passer les use cases (via leur interface) aux controllers.
4. Monter les routes Express.

Aucune classe concrète ne doit être importée en dehors du composition root et des tests.

---

## Checklist avant d'ouvrir la PR

- [ ] `npm run lint` — zéro avertissement
- [ ] `npm run format:check` — formatage conforme
- [ ] `npm run test` — tous les tests verts (unitaires + intégration HTTP)
- [ ] `npm run test:db` — tests DAO Testcontainers verts (migration rejouée depuis zéro)
- [ ] Migration `Vxxx__*.sql` idempotente (pattern `information_schema` pour ADD COLUMN / CREATE INDEX)
- [ ] Numéro de migration coordonné avec l'équipe (pas de doublon)
- [ ] `TransactionalRepositories` enrichi si le repo participe aux transactions
- [ ] Aucun import de lib npm dans `src/domain/`
- [ ] Controller dépend de l'**interface** use case, jamais de l'implémentation
- [ ] Erreurs applicatives avec un code symbolique stable documenté dans `CONTRAT_API.md`
- [ ] Composition root (`main.ts`) câblé avec les nouveaux use cases et routes
