/**
 * Types de structure du composition root, extraits de `main.ts` pour respecter la limite de
 * taille de fichier et améliorer la lisibilité. Ce fichier ne contient que des interfaces de
 * typage — aucune logique exécutable.
 */

// Infrastructure — repositories
import type { MysqlUnitOfWork } from "@infrastructure/persistence/mysql/MysqlUnitOfWork";
import type { PasswordHasherServiceImpl } from "@infrastructure/security/PasswordHasherServiceImpl";
import type { TokenHasherServiceImpl } from "@infrastructure/security/TokenHasherServiceImpl";
import type { IdGeneratorServiceImpl } from "@infrastructure/id/IdGeneratorServiceImpl";
import { createReferenceRepositories } from "@infrastructure/persistence/mysql/features/reference/createReferenceRepositories";
import { createFriendGroupRepositories } from "@infrastructure/persistence/mysql/features/friend-group/createFriendGroupRepositories";

// Application — ports repositories
import type { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import type { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import type { RefreshTokenRepository } from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
import type { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import type { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import type { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";

// Application — ports services
import type { AuthTokenService } from "@application/features/auth/abstractions/services/AuthTokenService";
import type { TokenProviderService } from "@application/features/auth/abstractions/services/TokenProviderService";
import type { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
import type { GroupAccessService } from "@application/features/friend-group/abstractions/services/GroupAccessService";

// Presentation — controllers
import type { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import type { UserController } from "@presentation/http/features/auth/controllers/UserController";
import type { CampaignController } from "@presentation/http/features/campaign/controllers/CampaignController";
import type { CampaignCharacterController } from "@presentation/http/features/campaign/controllers/CampaignCharacterController";
import type { SessionController } from "@presentation/http/features/session/controllers/SessionController";
import type { CharacterSheetController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetController";
import type { CharacterSheetExportController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetExportController";
import type { ReferenceController } from "@presentation/http/features/reference/controllers/ReferenceController";
import type { GroupController } from "@presentation/http/features/friend-group/controllers/GroupController";
import type { InvitationController } from "@presentation/http/features/friend-group/controllers/InvitationController";

/**
 * Regroupe les services partagés construits **une seule fois** dans le composition root.
 *
 * Typer avec les ports applicatifs (interfaces) plutôt que les implémentations concrètes
 * garantit que cette structure reste indépendante de la couche infrastructure.
 */
export interface AuthServices {
  userRepository: UserRepository;
  credentialRepository: CredentialRepository;
  refreshTokenRepository: RefreshTokenRepository;
  campaignRepository: CampaignRepository;
  sessionRepository: SessionRepository;
  characterSheetRepository: CharacterSheetRepository;
  referenceRepositories: ReturnType<typeof createReferenceRepositories>;
  friendGroupRepositories: ReturnType<typeof createFriendGroupRepositories>;
  unitOfWork: MysqlUnitOfWork;
  passwordHasher: PasswordHasherServiceImpl;
  tokenProvider: TokenProviderService;
  tokenHasher: TokenHasherServiceImpl;
  idGenerator: IdGeneratorServiceImpl;
  authTokenService: AuthTokenService;
  pdfGenerator: CharacterSheetPdfGenerator;
}

/**
 * Regroupe les controllers HTTP montés par {@link buildHttpApp}.
 *
 * Les passer en un seul objet (plutôt qu'en paramètres séparés) garde la signature lisible
 * à mesure que de nouvelles features ajoutent leur controller.
 */
export interface HttpControllers {
  readonly auth: AuthController;
  readonly user: UserController;
  readonly campaign: CampaignController;
  readonly campaignCharacter: CampaignCharacterController;
  readonly session: SessionController;
  readonly characterSheet: CharacterSheetController;
  readonly characterSheetExport: CharacterSheetExportController;
  readonly reference: ReferenceController;
  readonly group: GroupController;
  readonly invitation: InvitationController;
}

/**
 * Résultat de {@link buildControllers} : les controllers HTTP + le `groupAccessService`
 * réexposé pour que le bootstrap puisse l'injecter dans l'autorisateur de canaux temps réel
 * (un abonnement `group:{id}` n'est accordé qu'à un membre du groupe).
 */
export interface BuiltControllers {
  controllers: HttpControllers;
  groupAccessService: GroupAccessService;
}
