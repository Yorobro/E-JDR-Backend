import { User } from "@domain/features/auth/entities/User";
import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";

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
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
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

  /** Repos de lecture pour enrichir les vues (nom de campagne + pseudo du MJ). */
  private campaigns?: FakeCampaignRepository;
  private users?: FakeUserRepository;

  constructor(private readonly sheetRepository: FakeCharacterSheetRepository) {}

  /**
   * Branche les repos campagnes/utilisateurs pour que `findCampaignViewsBySheetId` résolve
   * le nom de la campagne et le pseudo du MJ (reproduit le double JOIN du SQL réel).
   */
  public attachLookups(campaigns: FakeCampaignRepository, users: FakeUserRepository): void {
    this.campaigns = campaigns;
    this.users = users;
  }

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

  public async findCampaignViewsBySheetId(
    characterSheetId: string,
  ): Promise<SheetCampaignView[]> {
    const suffix = `::${characterSheetId}`;
    const campaignIds = [...this.links]
      .filter((k) => k.endsWith(suffix))
      .map((k) => k.slice(0, k.length - suffix.length));
    const views: SheetCampaignView[] = [];
    for (const campaignId of campaignIds) {
      const campaign = await this.campaigns?.findById(campaignId);
      if (campaign != null) {
        const gameMaster = await this.users?.findById(campaign.gameMasterId);
        views.push({
          campaignId,
          campaignName: campaign.name.value,
          gameMasterPseudo: gameMaster?.pseudo ?? "",
        });
      }
    }
    return views;
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

/** Générateur PDF factice : renvoie un Buffer commençant par l'en-tête PDF, sans rendu réel. */
export class FakeCharacterSheetPdfGenerator implements CharacterSheetPdfGenerator {
  public async generate(): Promise<Buffer> {
    return Buffer.from("%PDF-fake");
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
  const users = overrides?.users ?? new FakeUserRepository();
  const campaigns = overrides?.campaigns ?? new FakeCampaignRepository();
  // La liaison enrichit ses vues via campagnes + utilisateurs (reproduit le double JOIN MySQL).
  campaignCharacters.attachLookups(campaigns, users);
  return {
    users,
    credentials: overrides?.credentials ?? new FakeCredentialRepository(),
    refreshTokens: overrides?.refreshTokens ?? new FakeRefreshTokenRepository(),
    campaigns,
    characterSheets,
    campaignCharacters,
  };
}

// Les fabriques de données de test (entités domaine pré-construites) vivent dans `builders.ts`
// (module séparé pour la lisibilité et la taille) ; re-exportées ici pour les imports existants.
export {
  buildTestCharacterSheet,
  buildTestCampaign,
  buildTestUser,
  buildTestCredential,
} from "./builders";
