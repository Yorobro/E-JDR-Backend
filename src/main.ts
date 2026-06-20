import express, { Application, RequestHandler } from "express";
import cookieParser from "cookie-parser";

import { AppConfig, loadConfig } from "@config/env";

// Infrastructure
import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { createAuthRepositories } from "@infrastructure/persistence/mysql/features/auth/createAuthRepositories";
import { createCampaignRepositories } from "@infrastructure/persistence/mysql/features/campaign/createCampaignRepositories";
import { createSessionRepositories } from "@infrastructure/persistence/mysql/features/session/createSessionRepositories";
import { createCharacterSheetRepositories } from "@infrastructure/persistence/mysql/features/character-sheet/createCharacterSheetRepositories";
import { createReferenceRepositories } from "@infrastructure/persistence/mysql/features/reference/createReferenceRepositories";
import { MysqlUnitOfWork } from "@infrastructure/persistence/mysql/MysqlUnitOfWork";
import { PasswordHasherServiceImpl } from "@infrastructure/security/PasswordHasherServiceImpl";
import { TokenProviderServiceImpl } from "@infrastructure/security/TokenProviderServiceImpl";
import { TokenHasherServiceImpl } from "@infrastructure/security/TokenHasherServiceImpl";
import { IdGeneratorServiceImpl } from "@infrastructure/id/IdGeneratorServiceImpl";
import { PinoLogger } from "@infrastructure/logging/PinoLogger";
import { PdfKitCharacterSheetPdfGenerator } from "@infrastructure/pdf/PdfKitCharacterSheetPdfGenerator";

// Application — ports repositories
import { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { RefreshTokenRepository } from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { SessionRepository } from "@application/features/session/abstractions/repositories/SessionRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
// Application — ports services
import { AuthTokenService } from "@application/features/auth/abstractions/services/AuthTokenService";
import { TokenProviderService } from "@application/features/auth/abstractions/services/TokenProviderService";
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
// Application — implémentations
import { Logger } from "@application/shared/Logger";
import { AuthTokenServiceImpl } from "@application/features/auth/services/AuthTokenServiceImpl";
import { RegisterUserUseCaseImpl } from "@application/features/auth/usecases/RegisterUserUseCaseImpl";
import { LoginUserUseCaseImpl } from "@application/features/auth/usecases/LoginUserUseCaseImpl";
import { LogoutUserUseCaseImpl } from "@application/features/auth/usecases/LogoutUserUseCaseImpl";
import { RefreshAccessTokenUseCaseImpl } from "@application/features/auth/usecases/RefreshAccessTokenUseCaseImpl";
import { GetCurrentUserUseCaseImpl } from "@application/features/auth/usecases/GetCurrentUserUseCaseImpl";

// Presentation — feature auth
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthRoutes } from "@presentation/http/features/auth/routes/authRoutes";
import { buildUserRoutes } from "@presentation/http/features/auth/routes/userRoutes";
// Presentation — feature campaign
import { CampaignController } from "@presentation/http/features/campaign/controllers/CampaignController";
import { CampaignCharacterController } from "@presentation/http/features/campaign/controllers/CampaignCharacterController";
import {
  buildCampaignController,
  buildCampaignCharacterController,
} from "@presentation/http/features/campaign/buildCampaignControllers";
import { buildCampaignRoutes } from "@presentation/http/features/campaign/routes/campaignRoutes";
// Presentation — feature session
import { SessionController } from "@presentation/http/features/session/controllers/SessionController";
import { buildSessionController } from "@presentation/http/features/session/buildSessionController";
import {
  buildCampaignSessionRoutes,
  buildSessionByIdRoutes,
} from "@presentation/http/features/session/routes/sessionRoutes";
// Presentation — feature character-sheet
import { CharacterSheetController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetController";
import { CharacterSheetExportController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetExportController";
import {
  buildCharacterSheetController,
  buildCharacterSheetExportController,
} from "@presentation/http/features/character-sheet/buildCharacterSheetControllers";
import { buildCharacterSheetRoutes } from "@presentation/http/features/character-sheet/routes/characterSheetRoutes";
import { buildCharacterSheetExportRoutes } from "@presentation/http/features/character-sheet/routes/characterSheetExportRoutes";
// Presentation — feature reference
import { ReferenceController } from "@presentation/http/features/reference/controllers/ReferenceController";
import { buildReferenceController } from "@presentation/http/features/reference/buildReferenceController";
import {
  buildReferenceCatalogueRoutes,
  buildSheetReferenceLinkRoutes,
} from "@presentation/http/features/reference/routes/referenceRoutes";
// Presentation — feature friend-group
import { GroupController } from "@presentation/http/features/friend-group/controllers/GroupController";
import { InvitationController } from "@presentation/http/features/friend-group/controllers/InvitationController";
import { buildGroupControllers } from "@presentation/http/features/friend-group/buildGroupControllers";
import { buildGroupRoutes } from "@presentation/http/features/friend-group/routes/groupRoutes";
import { buildInvitationRoutes } from "@presentation/http/features/friend-group/routes/invitationRoutes";
// Infrastructure — friend-group
import { createFriendGroupRepositories } from "@infrastructure/persistence/mysql/features/friend-group/createFriendGroupRepositories";
// Presentation — shared middlewares
import { requestIdMiddleware } from "@presentation/http/shared/middlewares/requestIdMiddleware";
import { buildHttpLoggerMiddleware } from "@presentation/http/shared/middlewares/httpLoggerMiddleware";
import { buildErrorHandler } from "@presentation/http/shared/middlewares/errorHandler";
import { buildAuthMiddleware } from "@presentation/http/shared/middlewares/authMiddleware";

/**
 * **Composition root** de l'application : seul endroit qui instancie les classes concrètes
 * et résout les dépendances (injection manuelle). C'est ce câblage qui rend chaque couche
 * interchangeable (DIP) : pour changer d'implémentation (ex : autre BDD), on ne touche qu'ici.
 *
 * Le flux d'assemblage suit les dépendances : infrastructure → services/use cases (application)
 * → controller/routes (présentation) → application Express.
 */

/**
 * Regroupe les services partagés construits **une seule fois** dans le composition root.
 *
 * Typer avec les ports applicatifs (interfaces) plutôt que les implémentations concrètes
 * garantit que cette structure reste indépendante de la couche infrastructure.
 */
interface AuthServices {
  userRepository: UserRepository;
  credentialRepository: CredentialRepository;
  refreshTokenRepository: RefreshTokenRepository;
  campaignRepository: CampaignRepository;
  sessionRepository: SessionRepository;
  characterSheetRepository: CharacterSheetRepository;
  campaignCharacterRepository: CampaignCharacterRepository;
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
 * Construit **une seule fois** les repositories, adapters de sécurité et services partagés.
 *
 * Centraliser ici évite de recréer des instances identiques pour câbler le middleware
 * d'authentification et `UserController` séparément des use cases du module auth.
 *
 * @param connection - La connexion MySQL active.
 * @param config - La configuration applicative (secrets JWT, environnement).
 * @returns L'ensemble des services prêts à être consommés par les controllers et middlewares.
 */
function buildServices(connection: MysqlConnection, config: AppConfig): AuthServices {
  const {
    users: userRepository,
    credentials: credentialRepository,
    refreshTokens: refreshTokenRepository,
  } = createAuthRepositories(connection.getDb());

  const { campaigns: campaignRepository } = createCampaignRepositories(connection.getDb());

  const { sessions: sessionRepository } = createSessionRepositories(connection.getDb());

  const {
    characterSheets: characterSheetRepository,
    campaignCharacters: campaignCharacterRepository,
  } = createCharacterSheetRepositories(connection.getDb());

  const referenceRepositories = createReferenceRepositories(connection.getDb());
  const friendGroupRepositories = createFriendGroupRepositories(connection.getDb());

  const unitOfWork = new MysqlUnitOfWork(connection);

  const passwordHasher = new PasswordHasherServiceImpl();
  const tokenProvider = new TokenProviderServiceImpl({
    accessSecret: config.jwt.accessSecret,
    refreshSecret: config.jwt.refreshSecret,
    accessExpiresIn: config.jwt.accessExpiresIn,
    refreshExpiresIn: config.jwt.refreshExpiresIn,
  });
  const tokenHasher = new TokenHasherServiceImpl();
  const idGenerator = new IdGeneratorServiceImpl();
  const pdfGenerator = new PdfKitCharacterSheetPdfGenerator();

  const authTokenService = new AuthTokenServiceImpl(
    tokenProvider,
    tokenHasher,
    idGenerator,
    refreshTokenRepository,
  );

  return {
    userRepository,
    credentialRepository,
    refreshTokenRepository,
    campaignRepository,
    sessionRepository,
    characterSheetRepository,
    campaignCharacterRepository,
    referenceRepositories,
    friendGroupRepositories,
    unitOfWork,
    passwordHasher,
    tokenProvider,
    tokenHasher,
    idGenerator,
    authTokenService,
    pdfGenerator,
  };
}

/**
 * Assemble le controller d'authentification à partir des services déjà construits.
 *
 * Reçoit les services pré-construits par {@link buildServices} — aucune instanciation
 * supplémentaire n'est effectuée ici.
 *
 * @param services - Les services partagés produits par {@link buildServices}.
 * @param config - La configuration applicative (flag `isProduction` pour les cookies).
 * @param logger - Le logger applicatif.
 * @returns Le controller d'authentification câblé.
 */
function buildAuthController(
  services: AuthServices,
  config: AppConfig,
  logger: Logger,
): AuthController {
  const registerUser = new RegisterUserUseCaseImpl(
    services.credentialRepository,
    services.passwordHasher,
    services.idGenerator,
    services.authTokenService,
    services.unitOfWork,
    logger,
  );
  const loginUser = new LoginUserUseCaseImpl(
    services.credentialRepository,
    services.passwordHasher,
    services.authTokenService,
    services.unitOfWork,
    logger,
  );
  const logoutUser = new LogoutUserUseCaseImpl(services.tokenHasher, services.unitOfWork);
  const refreshAccessToken = new RefreshAccessTokenUseCaseImpl(
    services.userRepository,
    services.refreshTokenRepository,
    services.tokenProvider,
    services.tokenHasher,
    services.authTokenService,
    services.unitOfWork,
  );

  return new AuthController(registerUser, loginUser, logoutUser, refreshAccessToken, config);
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
 * Construit l'application Express : middlewares globaux, routes, gestion d'erreurs.
 *
 * Exportée pour permettre des tests d'intégration HTTP (via supertest) qui montent la
 * pile Express réelle — routage, parsing JSON, cookies, controllers, gestion d'erreurs —
 * en injectant les controllers câblés sur des doublures, sans base de données.
 *
 * @param controllers - L'ensemble des controllers HTTP câblés.
 * @param authMiddleware - Le middleware de vérification du jeton d'accès.
 * @param logger - Le logger applicatif (injecté pour structurer les logs et les erreurs).
 * @returns L'application Express prête à écouter.
 */
export function buildHttpApp(
  controllers: HttpControllers,
  authMiddleware: RequestHandler,
  logger: Logger,
): Application {
  const app = express();

  // Le requestId doit être attaché en premier pour que tous les middlewares suivants
  // puissent corréler leurs logs avec l'identifiant de la requête.
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(buildHttpLoggerMiddleware(logger));

  app.use("/auth", buildAuthRoutes(controllers.auth));
  // Routes protégées : le middleware d'auth s'applique à tout ce qui est monté derrière.
  app.use("/me", authMiddleware, buildUserRoutes(controllers.user));
  app.use(
    "/campaigns",
    authMiddleware,
    buildCampaignRoutes(controllers.campaign, controllers.campaignCharacter),
  );
  // Sessions imbriquées sous une campagne (`/campaigns/:campaignId/sessions`) : routeur dédié
  // monté en plus du routeur campaign sur le même préfixe.
  app.use("/campaigns", authMiddleware, buildCampaignSessionRoutes(controllers.session));
  app.use("/sessions", authMiddleware, buildSessionByIdRoutes(controllers.session));
  app.use(
    "/character-sheets",
    authMiddleware,
    buildCharacterSheetRoutes(controllers.characterSheet),
  );
  app.use(
    "/character-sheets",
    authMiddleware,
    buildCharacterSheetExportRoutes(controllers.characterSheetExport),
  );
  // Liaisons N‑N fiche ↔ éléments de référence (`/character-sheets/:id/:type`) : routeur dédié.
  app.use(
    "/character-sheets",
    authMiddleware,
    buildSheetReferenceLinkRoutes(controllers.reference),
  );
  // Catalogue des éléments de référence créés par l'utilisateur.
  app.use("/reference", authMiddleware, buildReferenceCatalogueRoutes(controllers.reference));

  app.use("/groups", authMiddleware, buildGroupRoutes(controllers.group, controllers.invitation));
  app.use("/invitations", authMiddleware, buildInvitationRoutes(controllers.invitation));

  // Le middleware d'erreurs doit être enregistré en dernier.
  app.use(buildErrorHandler(logger));

  return app;
}

/**
 * Démarre le serveur : charge la config, ouvre la connexion BDD, assemble et écoute.
 *
 * @returns Une promesse résolue lorsque le serveur écoute.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = PinoLogger.create(config.logLevel);

  const connection = new MysqlConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
  });

  // Construction unique de tous les services partagés (repos, adapters de sécurité, authTokenService).
  const services = buildServices(connection, config);

  const controllers = buildControllers(services, config, logger);
  const authMiddleware = buildAuthMiddleware(services.tokenProvider);

  const app = buildHttpApp(controllers, authMiddleware, logger);

  app.listen(config.port, () => {
    logger.info("Serveur démarré", { port: config.port });
  });
}

/**
 * Assemble tous les controllers HTTP à partir des services partagés.
 *
 * Extrait de {@link bootstrap} pour garder ce dernier sous la limite de taille de fonction.
 * `buildGroupControllers` est construit en premier car il expose le `groupAccessService` dont
 * dépendent les controllers campaign, character-sheet et reference (scoping par groupe).
 *
 * @param services - Les services partagés produits par {@link buildServices}.
 * @param config - La configuration applicative (cookies, environnement).
 * @param logger - Le logger applicatif.
 * @returns L'ensemble des controllers prêts à être montés par {@link buildHttpApp}.
 */
function buildControllers(
  services: AuthServices,
  config: AppConfig,
  logger: Logger,
): HttpControllers {
  const authController = buildAuthController(services, config, logger);
  const userController = new UserController(
    new GetCurrentUserUseCaseImpl(services.userRepository, services.credentialRepository),
  );

  const {
    group: groupController,
    invitation: invitationController,
    groupAccessService,
  } = buildGroupControllers({
    friendGroupRepository: services.friendGroupRepositories.friendGroups,
    groupMemberRepository: services.friendGroupRepositories.groupMembers,
    groupInvitationRepository: services.friendGroupRepositories.groupInvitations,
    campaignRepository: services.campaignRepository,
    campaignCharacterRepository: services.campaignCharacterRepository,
    credentialRepository: services.credentialRepository,
    idGenerator: services.idGenerator,
    unitOfWork: services.unitOfWork,
    logger,
  });

  const campaignDeps = {
    campaignRepository: services.campaignRepository,
    characterSheetRepository: services.characterSheetRepository,
    campaignCharacterRepository: services.campaignCharacterRepository,
    groupAccessService,
    idGenerator: services.idGenerator,
    unitOfWork: services.unitOfWork,
    logger,
  };
  const sessionController = buildSessionController({
    campaignRepository: services.campaignRepository,
    sessionRepository: services.sessionRepository,
    idGenerator: services.idGenerator,
    unitOfWork: services.unitOfWork,
    logger,
    groupAccessService,
  });
  const characterSheetDeps = {
    characterSheetRepository: services.characterSheetRepository,
    campaignCharacterRepository: services.campaignCharacterRepository,
    formationRepository: services.referenceRepositories.formations,
    peupleRepository: services.referenceRepositories.peoples,
    competenceRepository: services.referenceRepositories.competences,
    formationCompetenceLinkRepository: services.referenceRepositories.formationCompetences,
    sheetArmesRepository: services.referenceRepositories.sheetArmes,
    sheetArmuresRepository: services.referenceRepositories.sheetArmures,
    sheetCompetencesRepository: services.referenceRepositories.sheetCompetences,
    sheetEquipementsRepository: services.referenceRepositories.sheetEquipements,
    sheetSortsRepository: services.referenceRepositories.sheetSorts,
    sheetMiraclesRepository: services.referenceRepositories.sheetMiracles,
    groupAccessService,
    pdfGenerator: services.pdfGenerator,
    idGenerator: services.idGenerator,
    unitOfWork: services.unitOfWork,
    logger,
  };

  return {
    auth: authController,
    user: userController,
    campaign: buildCampaignController(campaignDeps),
    campaignCharacter: buildCampaignCharacterController(campaignDeps),
    session: sessionController,
    characterSheet: buildCharacterSheetController(characterSheetDeps),
    characterSheetExport: buildCharacterSheetExportController(characterSheetDeps),
    reference: buildReferenceController({
      characterSheetRepository: services.characterSheetRepository,
      references: services.referenceRepositories,
      idGenerator: services.idGenerator,
      groupAccessService,
      unitOfWork: services.unitOfWork,
      logger,
    }),
    group: groupController,
    invitation: invitationController,
  };
}

// Démarre le serveur uniquement lorsque ce fichier est exécuté directement
// (et non lorsqu'il est importé, par ex. par les tests d'intégration qui réutilisent
// `buildHttpApp` sans ouvrir de connexion MySQL).
if (require.main === module) {
  void bootstrap().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Échec du démarrage de l'application :", error);
    process.exit(1);
  });
}
