import { User } from "@domain/features/auth/entities/User";
import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { HashedPassword } from "@domain/features/auth/value-objects/HashedPassword";
import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import {
  CharacterSheet,
  CharacterSheetDetails,
} from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetName } from "@domain/features/character-sheet/value-objects/CharacterSheetName";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";

import { Logger } from "@application/shared/Logger";
import { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import {
  RefreshTokenRepository,
  StoredRefreshToken,
} from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
import { PasswordHasherService } from "@application/features/auth/abstractions/services/PasswordHasherService";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";
import { TokenHasherService } from "@application/features/auth/abstractions/services/TokenHasherService";
import {
  TokenProviderService,
  SignedToken,
  TokenPayload,
} from "@application/features/auth/abstractions/services/TokenProviderService";
import {
  AuthTokens,
  AuthTokenService,
} from "@application/features/auth/abstractions/services/AuthTokenService";
import { UnitOfWork, TransactionalRepositories } from "@application/shared/UnitOfWork";

/**
 * Fabriques de doublures de test (fakes) pour les ports applicatifs.
 *
 * Ces implémentations en mémoire permettent de tester les use cases en isolation, sans BDD
 * ni cryptographie réelle. Elles respectent strictement les interfaces (ports), exactement
 * comme les implémentations d'infrastructure.
 */

/** Repository utilisateur métier en mémoire (indexé par id). */
export class FakeUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  public async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  public async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  /** Aide de test : pré-remplit le repository avec un utilisateur. */
  public seed(user: User): void {
    this.users.set(user.id, user);
  }
}

/** Repository d'identifiants d'authentification en mémoire (indexé par e-mail). */
export class FakeCredentialRepository implements CredentialRepository {
  private readonly credentials = new Map<string, Credential>();

  public async findByEmail(email: Email): Promise<Credential | null> {
    return this.credentials.get(email.value) ?? null;
  }

  public async findByUserId(userId: string): Promise<Credential | null> {
    for (const credential of this.credentials.values()) {
      if (credential.userId === userId) {
        return credential;
      }
    }
    return null;
  }

  public async existsByEmail(email: Email): Promise<boolean> {
    return this.credentials.has(email.value);
  }

  public async save(credential: Credential): Promise<void> {
    this.credentials.set(credential.email.value, credential);
  }

  public async update(credential: Credential): Promise<void> {
    this.credentials.set(credential.email.value, credential);
  }

  /** Aide de test : pré-remplit le repository avec un identifiant. */
  public seed(credential: Credential): void {
    this.credentials.set(credential.email.value, credential);
  }
}

/** Repository de refresh tokens en mémoire. */
export class FakeRefreshTokenRepository implements RefreshTokenRepository {
  public readonly tokens = new Map<string, StoredRefreshToken>();

  public async save(token: StoredRefreshToken): Promise<void> {
    this.tokens.set(token.tokenHash, token);
  }

  public async findByTokenHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.tokens.get(tokenHash) ?? null;
  }

  public async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.tokens.delete(tokenHash);
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    for (const [hash, token] of this.tokens.entries()) {
      if (token.userId === userId) {
        this.tokens.delete(hash);
      }
    }
  }

  public async deleteExpired(now: Date): Promise<void> {
    for (const [hash, token] of this.tokens.entries()) {
      if (token.expiresAt.getTime() < now.getTime()) {
        this.tokens.delete(hash);
      }
    }
  }
}

/** Repository de campagnes en mémoire (indexé par id). */
export class FakeCampaignRepository implements CampaignRepository {
  private readonly campaigns = new Map<string, Campaign>();

  public async save(campaign: Campaign): Promise<void> {
    this.campaigns.set(campaign.id, campaign);
  }

  public async findByGameMasterId(gameMasterId: string): Promise<Campaign[]> {
    return [...this.campaigns.values()].filter((campaign) => campaign.isGameMaster(gameMasterId));
  }

  public async findById(id: string): Promise<Campaign | null> {
    return this.campaigns.get(id) ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    this.campaigns.delete(id);
  }

  /** Aide de test : pré-remplit le repository avec une campagne. */
  public seed(campaign: Campaign): void {
    this.campaigns.set(campaign.id, campaign);
  }
}

/** Repository de fiches de personnage en mémoire (indexé par id). */
export class FakeCharacterSheetRepository implements CharacterSheetRepository {
  private readonly sheets = new Map<string, CharacterSheet>();

  /**
   * Repository de liaison, source de vérité des fiches déjà rattachées (renseigné après
   * construction par {@link attachCampaignCharacters} pour éviter la dépendance circulaire).
   */
  private campaignCharacters?: FakeCampaignCharacterRepository;

  public async save(sheet: CharacterSheet): Promise<void> {
    this.sheets.set(sheet.id, sheet);
  }

  public async update(sheet: CharacterSheet): Promise<void> {
    this.sheets.set(sheet.id, sheet);
  }

  public async findByOwnerId(ownerId: string): Promise<CharacterSheet[]> {
    return [...this.sheets.values()].filter((sheet) => sheet.isOwnedBy(ownerId));
  }

  public async findById(id: string): Promise<CharacterSheet | null> {
    return this.sheets.get(id) ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    this.sheets.delete(id);
  }

  /**
   * Branche le repository de liaison pour que `findLinkableForCampaign` consulte les
   * vraies liaisons (celles créées via `link()`), comme le `NOT EXISTS` du SQL réel.
   */
  public attachCampaignCharacters(campaignCharacters: FakeCampaignCharacterRepository): void {
    this.campaignCharacters = campaignCharacters;
  }

  public async findLinkableForCampaign(
    gameMasterId: string,
    campaignId: string,
  ): Promise<CharacterSheet[]> {
    const candidates = [...this.sheets.values()].filter((sheet) => !sheet.isOwnedBy(gameMasterId));
    const linkable: CharacterSheet[] = [];
    for (const sheet of candidates) {
      const alreadyLinked =
        (await this.campaignCharacters?.existsByCampaignAndSheet(campaignId, sheet.id)) ?? false;
      if (!alreadyLinked) {
        linkable.push(sheet);
      }
    }
    return linkable;
  }

  /** Aide de test : pré-remplit le repository avec une fiche. */
  public seed(sheet: CharacterSheet): void {
    this.sheets.set(sheet.id, sheet);
  }
}

/**
 * Repository de liaison campagne↔fiches en mémoire.
 *
 * Stocke les paires `campaignId::sheetId` et résout les fiches via le repository de fiches
 * fourni (pour `findSheetsByCampaignId`), reproduisant le JOIN de l'implémentation MySQL.
 */
export class FakeCampaignCharacterRepository implements CampaignCharacterRepository {
  private readonly links = new Set<string>();

  constructor(private readonly sheetRepository: FakeCharacterSheetRepository) {}

  private key(campaignId: string, sheetId: string): string {
    return `${campaignId}::${sheetId}`;
  }

  public async link(campaignId: string, characterSheetId: string): Promise<void> {
    this.links.add(this.key(campaignId, characterSheetId));
  }

  public async unlink(campaignId: string, characterSheetId: string): Promise<void> {
    this.links.delete(this.key(campaignId, characterSheetId));
  }

  public async existsByCampaignAndSheet(
    campaignId: string,
    characterSheetId: string,
  ): Promise<boolean> {
    return this.links.has(this.key(campaignId, characterSheetId));
  }

  public async findSheetsByCampaignId(campaignId: string): Promise<CharacterSheet[]> {
    const prefix = `${campaignId}::`;
    const sheetIds = [...this.links]
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
    const sheets: CharacterSheet[] = [];
    for (const id of sheetIds) {
      const sheet = await this.sheetRepository.findById(id);
      if (sheet !== null) {
        sheets.push(sheet);
      }
    }
    return sheets;
  }
}

/** Hasher de mot de passe factice : préfixe "hashed:" et compare en conséquence. */
export class FakePasswordHasher implements PasswordHasherService {
  public async hash(plainPassword: string): Promise<string> {
    return `hashed:${plainPassword}`;
  }

  public async compare(plainPassword: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plainPassword}`;
  }
}

/** Générateur d'identifiants déterministe (incrémental). */
export class FakeIdGenerator implements IdGeneratorService {
  private counter = 0;

  public generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

/** Hasher de token déterministe factice. */
export class FakeTokenHasher implements TokenHasherService {
  public hash(token: string): string {
    return `thash:${token}`;
  }
}

/** Provider de tokens factice : encode le payload en JSON, validité contrôlable. */
export class FakeTokenProvider implements TokenProviderService {
  /** Permet de simuler un refresh token invalide dans les tests. */
  public refreshTokenValid = true;

  public signAccessToken(payload: TokenPayload): SignedToken {
    return { token: `access:${JSON.stringify(payload)}`, expiresAt: new Date("2999-01-01") };
  }

  public signRefreshToken(payload: TokenPayload): SignedToken {
    return { token: `refresh:${JSON.stringify(payload)}`, expiresAt: new Date("2999-01-01") };
  }

  public verifyAccessToken(token: string): TokenPayload | null {
    return this.decode(token, "access:");
  }

  public verifyRefreshToken(token: string): TokenPayload | null {
    if (!this.refreshTokenValid) {
      return null;
    }
    return this.decode(token, "refresh:");
  }

  private decode(token: string, prefix: string): TokenPayload | null {
    if (!token.startsWith(prefix)) {
      return null;
    }
    return JSON.parse(token.slice(prefix.length)) as TokenPayload;
  }
}

/** Service de tokens factice : produit une paire fixe et trace les identités servies. */
export class FakeAuthTokenService implements AuthTokenService {
  public readonly issuedFor: string[] = [];

  public async issueTokens(
    userId: string,
    _email: string,
    _refreshTokenRepo?: RefreshTokenRepository,
  ): Promise<AuthTokens> {
    this.issuedFor.push(userId);
    return {
      accessToken: `access-for-${userId}`,
      accessTokenExpiresAt: new Date("2999-01-01"),
      refreshToken: `refresh-for-${userId}`,
      refreshTokenExpiresAt: new Date("2999-01-01"),
    };
  }
}

/** Logger no-op pour les tests : absorbe silencieusement tous les appels. */
export class FakeLogger implements Logger {
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public debug(): void {}
  public child(): Logger {
    return this;
  }
}

/**
 * UnitOfWork factice : exécute le callback avec un bundle de repos en mémoire, sans
 * vraie transaction. Si le callback lève, l'erreur remonte telle quelle (les fakes ne
 * « rollback » pas, mais le test peut vérifier la propagation de l'erreur).
 */
export class FakeUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: TransactionalRepositories) {}

  public execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}

/**
 * Aide de test : assemble un `TransactionalRepositories` à partir de fakes.
 * Réutilise les fakes fournis pour que le test puisse inspecter leur état après coup.
 */
export function buildFakeTransactionalRepositories(overrides?: {
  users?: FakeUserRepository;
  credentials?: FakeCredentialRepository;
  refreshTokens?: FakeRefreshTokenRepository;
  campaigns?: FakeCampaignRepository;
  characterSheets?: FakeCharacterSheetRepository;
}): TransactionalRepositories & {
  users: FakeUserRepository;
  credentials: FakeCredentialRepository;
  refreshTokens: FakeRefreshTokenRepository;
  campaigns: FakeCampaignRepository;
  characterSheets: FakeCharacterSheetRepository;
  campaignCharacters: FakeCampaignCharacterRepository;
} {
  const characterSheets = overrides?.characterSheets ?? new FakeCharacterSheetRepository();
  // La liaison résout les fiches via le repo de fiches (reproduit le JOIN MySQL).
  const campaignCharacters = new FakeCampaignCharacterRepository(characterSheets);
  // Lien retour : `findLinkableForCampaign` doit voir les vraies liaisons (NOT EXISTS du SQL).
  characterSheets.attachCampaignCharacters(campaignCharacters);
  return {
    users: overrides?.users ?? new FakeUserRepository(),
    credentials: overrides?.credentials ?? new FakeCredentialRepository(),
    refreshTokens: overrides?.refreshTokens ?? new FakeRefreshTokenRepository(),
    campaigns: overrides?.campaigns ?? new FakeCampaignRepository(),
    characterSheets,
    campaignCharacters,
  };
}

/**
 * Aide de test : construit une fiche de personnage.
 *
 * @param id - L'identifiant de la fiche (par défaut "sheet-1").
 * @param ownerId - L'identifiant du propriétaire (par défaut "user-1").
 * @param name - Le nom de la fiche (par défaut "Aragorn").
 * @param details - Champs détaillés optionnels (identité, caractéristiques, textes longs).
 * @returns Une entité `CharacterSheet` prête pour les tests.
 */
export function buildTestCharacterSheet(
  id = "sheet-1",
  ownerId = "user-1",
  name = "Aragorn",
  details: Partial<CharacterSheetDetails> = {},
): CharacterSheet {
  return CharacterSheet.create({
    id,
    ownerId,
    name: CharacterSheetName.create(name),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...details,
  });
}

/**
 * Aide de test : construit une campagne.
 *
 * @param id - L'identifiant de la campagne (par défaut "campaign-1").
 * @param gameMasterId - L'identifiant du MJ propriétaire (par défaut "user-1").
 * @param name - Le nom de la campagne (par défaut "Ma campagne").
 * @returns Une entité `Campaign` prête pour les tests.
 */
export function buildTestCampaign(
  id = "campaign-1",
  gameMasterId = "user-1",
  name = "Ma campagne",
): Campaign {
  return Campaign.create({
    id,
    gameMasterId,
    name: CampaignName.create(name),
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
}

/**
 * Aide de test : construit un utilisateur métier.
 *
 * @param id - L'identifiant (par défaut "user-1").
 * @param pseudo - Le pseudo (par défaut "Joueur").
 * @returns Une entité `User` prête pour les tests.
 */
export function buildTestUser(id = "user-1", pseudo = "Joueur"): User {
  return User.create({ id, pseudo, createdAt: new Date("2025-01-01T00:00:00Z") });
}

/**
 * Aide de test : construit un identifiant d'authentification avec un mot de passe déjà
 * "haché" par le fake hasher.
 *
 * @param email - L'e-mail du compte.
 * @param plainPassword - Le mot de passe en clair (sera préfixé "hashed:").
 * @param userId - L'identifiant de l'utilisateur rattaché (par défaut "user-1").
 * @param id - L'identifiant de l'enregistrement (par défaut "cred-1").
 * @returns Une entité `Credential` prête pour les tests.
 */
export function buildTestCredential(
  email: string,
  plainPassword: string,
  userId = "user-1",
  id = "cred-1",
): Credential {
  return Credential.create({
    id,
    userId,
    email: Email.create(email),
    password: HashedPassword.fromHash(`hashed:${plainPassword}`),
    createdAt: new Date("2025-01-01T00:00:00Z"),
  });
}
