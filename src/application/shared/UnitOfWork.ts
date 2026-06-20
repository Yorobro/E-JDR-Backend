import { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { RefreshTokenRepository } from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
import {
  ArmeRepository,
  ArmureRepository,
  CompetenceRepository,
  EquipementRepository,
  FormationRepository,
  MiracleRepository,
  PeupleRepository,
  SortRepository,
} from "@application/features/reference/abstractions/repositories/ReferenceRepository";
import {
  SheetArmeLinkRepository,
  SheetArmureLinkRepository,
  SheetCompetenceLinkRepository,
  SheetEquipementLinkRepository,
  SheetMiracleLinkRepository,
  SheetSortLinkRepository,
} from "@application/features/reference/abstractions/repositories/SheetReferenceLinkRepository";
import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { FriendGroupRepository } from "@application/features/friend-group/abstractions/repositories/FriendGroupRepository";
import { GroupMemberRepository } from "@application/features/friend-group/abstractions/repositories/GroupMemberRepository";
import { GroupInvitationRepository } from "@application/features/friend-group/abstractions/repositories/GroupInvitationRepository";

/**
 * Jeu de repositories liés à une même transaction, fournis au callback d'un `UnitOfWork`.
 *
 * Exposé « au besoin » : seuls les repos réellement utilisés dans des écritures
 * transactionnelles figurent ici. Un nouveau domaine (ex. campaign) ajoutera ses repos.
 */
export interface TransactionalRepositories {
  readonly users: UserRepository;
  readonly credentials: CredentialRepository;
  readonly refreshTokens: RefreshTokenRepository;
  readonly campaigns: CampaignRepository;
  readonly sessions: SessionRepository;
  readonly characterSheets: CharacterSheetRepository;
  readonly campaignCharacters: CampaignCharacterRepository;
  // Catalogues d'éléments de référence (un par type).
  readonly formations: FormationRepository;
  readonly peoples: PeupleRepository;
  readonly armes: ArmeRepository;
  readonly armures: ArmureRepository;
  readonly competences: CompetenceRepository;
  readonly equipements: EquipementRepository;
  readonly sorts: SortRepository;
  readonly miracles: MiracleRepository;
  // Liaisons N‑N fiche ↔ éléments de référence (une par type liable).
  readonly sheetArmes: SheetArmeLinkRepository;
  readonly sheetArmures: SheetArmureLinkRepository;
  readonly sheetCompetences: SheetCompetenceLinkRepository;
  readonly sheetEquipements: SheetEquipementLinkRepository;
  readonly sheetSorts: SheetSortLinkRepository;
  readonly sheetMiracles: SheetMiracleLinkRepository;
  // Liaison N‑N formation ↔ compétences.
  readonly formationCompetences: FormationCompetenceLinkRepository;
  // Groupes d'amis.
  readonly friendGroups: FriendGroupRepository;
  readonly groupMembers: GroupMemberRepository;
  readonly groupInvitations: GroupInvitationRepository;
}

/**
 * Port « out » d'unité de travail (Unit of Work).
 *
 * Règle d'architecture : **toute écriture** en base passe par `execute()`. Le callback
 * reçoit des repos liés à la transaction ; s'il lève, tout est annulé (rollback global),
 * sinon tout est validé (commit). Les lectures pures n'ont pas besoin du UnitOfWork.
 */
export interface UnitOfWork {
  execute<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
