import { User } from "@domain/features/auth/entities/User";
import { Credential } from "@domain/features/auth/entities/Credential";
import { Email } from "@domain/features/auth/value-objects/Email";
import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { Session } from "@domain/features/session/entities/Session";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import {
  FakeReferenceRepository,
  FakeSheetReferenceLinkRepository,
  FakeFormationCompetenceLinkRepository,
} from "./referenceFakes";
import { CharacterSheet } from "@domain/features/character-sheet/entities/CharacterSheet";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
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

  public async updateEmail(credential: Credential): Promise<void> {
    // Retire l'ancienne entrée (indexée par ancien email) et insère sous le nouvel email.
    for (const [key, stored] of this.credentials.entries()) {
      if (stored.id === credential.id) {
        this.credentials.delete(key);
        break;
      }
    }
    this.credentials.set(credential.email.value, credential);
  }

  public async updatePassword(credential: Credential): Promise<void> {
    // L'email ne change pas : mise à jour en place sans réindexation.
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

  public async findByGroupId(groupId: string): Promise<Campaign[]> {
    return [...this.campaigns.values()].filter((campaign) => campaign.groupId === groupId);
  }

  public async existsByGroupId(groupId: string): Promise<boolean> {
    return [...this.campaigns.values()].some((campaign) => campaign.groupId === groupId);
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

/**
 * Repository de fiches de personnage en mémoire (indexé par id).
 *
 * Modèle « une fiche = une campagne » : la fiche porte directement sa `campaignId` et son
 * `linkStatus`. Les lectures cross‑agrégat (`findCampaignViewBySheetId`) résolvent le nom de la
 * campagne et le pseudo du MJ via les repos campagnes/utilisateurs branchés par {@link attachLookups}.
 */
export class FakeCharacterSheetRepository implements CharacterSheetRepository {
  private readonly sheets = new Map<string, CharacterSheet>();

  /** Repos de lecture pour enrichir la vue de campagne (nom de campagne + pseudo du MJ). */
  private campaigns?: FakeCampaignRepository;
  private users?: FakeUserRepository;

  public async save(sheet: CharacterSheet): Promise<void> {
    this.sheets.set(sheet.id, sheet);
  }

  public async update(sheet: CharacterSheet): Promise<void> {
    this.sheets.set(sheet.id, sheet);
  }

  public async findByOwnerId(ownerId: string): Promise<CharacterSheet[]> {
    return [...this.sheets.values()].filter((sheet) => sheet.isOwnedBy(ownerId));
  }

  public async findByGroupId(groupId: string): Promise<CharacterSheet[]> {
    return [...this.sheets.values()].filter((sheet) => sheet.isInGroup(groupId));
  }

  public async findById(id: string): Promise<CharacterSheet | null> {
    return this.sheets.get(id) ?? null;
  }

  public async deleteById(id: string): Promise<void> {
    this.sheets.delete(id);
  }

  public async findByCampaignIdAndStatus(
    campaignId: string,
    status: string,
  ): Promise<CharacterSheet[]> {
    return [...this.sheets.values()].filter(
      (sheet) => sheet.campaignId === campaignId && sheet.linkStatus.value === status,
    );
  }

  public async updateLinkStatus(id: string, status: string): Promise<void> {
    const sheet = this.sheets.get(id);
    if (sheet === undefined) {
      return;
    }
    // Reconstruit la fiche avec le nouveau statut (l'entité est immuable de l'extérieur).
    const updated = status === "ACCEPTED" ? sheet.accept() : sheet;
    this.sheets.set(id, updated);
  }

  /**
   * Branche les repos campagnes/utilisateurs pour que `findCampaignViewBySheetId` résolve le nom
   * de la campagne et le pseudo du MJ (reproduit le double JOIN du SQL réel).
   */
  public attachLookups(campaigns: FakeCampaignRepository, users: FakeUserRepository): void {
    this.campaigns = campaigns;
    this.users = users;
  }

  public async findCampaignViewBySheetId(sheetId: string): Promise<SheetCampaignView | null> {
    const sheet = this.sheets.get(sheetId);
    if (sheet === undefined) {
      return null;
    }
    const campaign = await this.campaigns?.findById(sheet.campaignId);
    if (campaign == null) {
      return null;
    }
    const gameMaster = await this.users?.findById(campaign.gameMasterId);
    return {
      campaignId: campaign.id,
      campaignName: campaign.name.value,
      gameMasterPseudo: gameMaster?.pseudo ?? "",
      linkStatus: sheet.linkStatus.value,
    };
  }

  /** Aide de test : pré-remplit le repository avec une fiche. */
  public seed(sheet: CharacterSheet): void {
    this.sheets.set(sheet.id, sheet);
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
  formations: FakeReferenceRepository;
  peoples: FakeReferenceRepository;
  armes: FakeReferenceRepository;
  armures: FakeReferenceRepository;
  competences: FakeReferenceRepository;
  equipements: FakeReferenceRepository;
  sorts: FakeReferenceRepository;
  miracles: FakeReferenceRepository;
  sheetArmes: FakeSheetReferenceLinkRepository;
  sheetArmures: FakeSheetReferenceLinkRepository;
  sheetCompetences: FakeSheetReferenceLinkRepository;
  sheetEquipements: FakeSheetReferenceLinkRepository;
  sheetSorts: FakeSheetReferenceLinkRepository;
  sheetMiracles: FakeSheetReferenceLinkRepository;
  formationCompetences: FakeFormationCompetenceLinkRepository;
  friendGroups: FakeFriendGroupRepository;
  groupMembers: FakeGroupMemberRepository;
  groupInvitations: FakeGroupInvitationRepository;
} {
  const characterSheets = overrides?.characterSheets ?? new FakeCharacterSheetRepository();
  const users = overrides?.users ?? new FakeUserRepository();
  const campaigns = overrides?.campaigns ?? new FakeCampaignRepository();
  // La fiche enrichit sa vue de campagne via campagnes + utilisateurs (reproduit le double JOIN MySQL).
  characterSheets.attachLookups(campaigns, users);

  // Catalogues de référence (un par type) + liaisons N‑N (chacune branchée sur son catalogue
  // pour que `findItemsBySheet` résolve les éléments, comme le JOIN SQL).
  const formations = new FakeReferenceRepository();
  const peoples = new FakeReferenceRepository();
  const armes = new FakeReferenceRepository();
  const armures = new FakeReferenceRepository();
  const competences = new FakeReferenceRepository();
  const equipements = new FakeReferenceRepository();
  const sorts = new FakeReferenceRepository();
  const miracles = new FakeReferenceRepository();

  return {
    users,
    credentials: overrides?.credentials ?? new FakeCredentialRepository(),
    refreshTokens: overrides?.refreshTokens ?? new FakeRefreshTokenRepository(),
    campaigns,
    sessions: overrides?.sessions ?? new FakeSessionRepository(),
    characterSheets,
    formations,
    peoples,
    armes,
    armures,
    competences,
    equipements,
    sorts,
    miracles,
    sheetArmes: new FakeSheetReferenceLinkRepository(armes),
    sheetArmures: new FakeSheetReferenceLinkRepository(armures),
    sheetCompetences: new FakeSheetReferenceLinkRepository(competences),
    sheetEquipements: new FakeSheetReferenceLinkRepository(equipements),
    sheetSorts: new FakeSheetReferenceLinkRepository(sorts),
    sheetMiracles: new FakeSheetReferenceLinkRepository(miracles),
    formationCompetences: new FakeFormationCompetenceLinkRepository(),
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
export {
  FakeReferenceRepository,
  FakeSheetReferenceLinkRepository,
  FakeFormationCompetenceLinkRepository,
} from "./referenceFakes";

// Doublures de services (hash/token/id/pdf/logger) : définies dans `serviceFakes.ts`,
// re-exportées ici pour préserver les imports existants `from "./fakes"`.
export {
  FakePasswordHasher,
  FakeIdGenerator,
  FakeTokenHasher,
  FakeTokenProvider,
  FakeAuthTokenService,
  FakeCharacterSheetPdfGenerator,
  FakeRealtimeNotifier,
  FakeLogger,
} from "./serviceFakes";
