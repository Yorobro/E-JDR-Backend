import { User } from "@domain/features/auth/entities/User";
import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { Session } from "@domain/features/session/entities/Session";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { FakeReferenceRepository, FakeSheetReferenceLinkRepository } from "./referenceFakes";
import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";

import { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import {
  FakeFriendGroupRepository,
  FakeGroupMemberRepository,
  FakeGroupInvitationRepository,
} from "./friendGroupFakes";
import {
  RefreshTokenRepository,
  StoredRefreshToken,
} from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
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

/** Repository de sessions en mémoire (indexé par id). */
export class FakeSessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  public async save(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  public async update(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  public async findByCampaignId(campaignId: string): Promise<Session[]> {
    return [...this.sessions.values()]
      .filter((session) => session.campaignId === campaignId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  public async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  /** Aide de test : pré-remplit le repository avec une session. */
  public seed(session: Session): void {
    this.sessions.set(session.id, session);
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

  public async findCampaignViewsBySheetId(characterSheetId: string): Promise<SheetCampaignView[]> {
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
  sessions?: FakeSessionRepository;
  characterSheets?: FakeCharacterSheetRepository;
}): TransactionalRepositories & {
  users: FakeUserRepository;
  credentials: FakeCredentialRepository;
  refreshTokens: FakeRefreshTokenRepository;
  campaigns: FakeCampaignRepository;
  sessions: FakeSessionRepository;
  characterSheets: FakeCharacterSheetRepository;
  campaignCharacters: FakeCampaignCharacterRepository;
  formations: FakeReferenceRepository;
  peoples: FakeReferenceRepository;
  armes: FakeReferenceRepository;
  armures: FakeReferenceRepository;
  competences: FakeReferenceRepository;
  equipements: FakeReferenceRepository;
  sheetArmes: FakeSheetReferenceLinkRepository;
  sheetArmures: FakeSheetReferenceLinkRepository;
  sheetCompetences: FakeSheetReferenceLinkRepository;
  sheetEquipements: FakeSheetReferenceLinkRepository;
  friendGroups: FakeFriendGroupRepository;
  groupMembers: FakeGroupMemberRepository;
  groupInvitations: FakeGroupInvitationRepository;
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

  // Catalogues de référence (un par type) + liaisons N‑N (chacune branchée sur son catalogue
  // pour que `findItemsBySheet` résolve les éléments, comme le JOIN SQL).
  const formations = new FakeReferenceRepository();
  const peoples = new FakeReferenceRepository();
  const armes = new FakeReferenceRepository();
  const armures = new FakeReferenceRepository();
  const competences = new FakeReferenceRepository();
  const equipements = new FakeReferenceRepository();

  return {
    users,
    credentials: overrides?.credentials ?? new FakeCredentialRepository(),
    refreshTokens: overrides?.refreshTokens ?? new FakeRefreshTokenRepository(),
    campaigns,
    sessions: overrides?.sessions ?? new FakeSessionRepository(),
    characterSheets,
    campaignCharacters,
    formations,
    peoples,
    armes,
    armures,
    competences,
    equipements,
    sheetArmes: new FakeSheetReferenceLinkRepository(armes),
    sheetArmures: new FakeSheetReferenceLinkRepository(armures),
    sheetCompetences: new FakeSheetReferenceLinkRepository(competences),
    sheetEquipements: new FakeSheetReferenceLinkRepository(equipements),
    friendGroups: new FakeFriendGroupRepository(),
    groupMembers: new FakeGroupMemberRepository(),
    groupInvitations: new FakeGroupInvitationRepository(),
  };
}

// Doublures de la feature friend-group : définies dans `friendGroupFakes.ts`,
// re-exportées ici pour que les tests les importent depuis `./fakes` comme les autres.
export {
  FakeFriendGroupRepository,
  FakeGroupMemberRepository,
  FakeGroupInvitationRepository,
  buildTestFriendGroup,
  buildTestMembership,
  buildTestInvitation,
} from "./friendGroupFakes";

// Les fabriques de données de test (entités domaine pré-construites) vivent dans `builders.ts`
// (module séparé pour la lisibilité et la taille) ; re-exportées ici pour les imports existants.
export {
  buildTestCharacterSheet,
  buildTestCampaign,
  buildTestSession,
  buildTestReferenceItem,
  buildTestUser,
  buildTestCredential,
} from "./builders";

// Doublures de la feature référence : définies dans `referenceFakes.ts` (taille de fichier),
// re-exportées ici pour que les tests les importent depuis `./fakes` comme les autres.
export { FakeReferenceRepository, FakeSheetReferenceLinkRepository } from "./referenceFakes";

// Doublures de services (hash/token/id/pdf/logger) : définies dans `serviceFakes.ts`,
// re-exportées ici pour préserver les imports existants `from "./fakes"`.
export {
  FakePasswordHasher,
  FakeIdGenerator,
  FakeTokenHasher,
  FakeTokenProvider,
  FakeAuthTokenService,
  FakeCharacterSheetPdfGenerator,
  FakeLogger,
} from "./serviceFakes";
