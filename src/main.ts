import express, { Application, RequestHandler } from "express";
import cookieParser from "cookie-parser";

import { AppConfig, loadConfig } from "@config/env";

// Infrastructure
import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { createAuthRepositories } from "@infrastructure/persistence/mysql/features/auth/createAuthRepositories";
import { createCampaignRepositories } from "@infrastructure/persistence/mysql/features/campaign/createCampaignRepositories";
import { createCharacterSheetRepositories } from "@infrastructure/persistence/mysql/features/character-sheet/createCharacterSheetRepositories";
import { MysqlUnitOfWork } from "@infrastructure/persistence/mysql/MysqlUnitOfWork";
import { PasswordHasherServiceImpl } from "@infrastructure/security/PasswordHasherServiceImpl";
import { TokenProviderServiceImpl } from "@infrastructure/security/TokenProviderServiceImpl";
import { TokenHasherServiceImpl } from "@infrastructure/security/TokenHasherServiceImpl";
import { IdGeneratorServiceImpl } from "@infrastructure/id/IdGeneratorServiceImpl";
import { PinoLogger } from "@infrastructure/logging/PinoLogger";

// Application — ports repositories
import { UserRepository } from "@application/features/auth/abstractions/repositories/UserRepository";
import { CredentialRepository } from "@application/features/auth/abstractions/repositories/CredentialRepository";
import { RefreshTokenRepository } from "@application/features/auth/abstractions/repositories/RefreshTokenRepository";
import { CampaignRepository } from "@application/features/campaign/abstractions/repositories/CampaignRepository";
import { CharacterSheetRepository } from "@application/features/character-sheet/abstractions/repositories/CharacterSheetRepository";
import { CampaignCharacterRepository } from "@application/features/character-sheet/abstractions/repositories/CampaignCharacterRepository";
// Application — ports services
import { AuthTokenService } from "@application/features/auth/abstractions/services/AuthTokenService";
import { TokenProviderService } from "@application/features/auth/abstractions/services/TokenProviderService";
// Application — implémentations
import { Logger } from "@application/shared/Logger";
import { AuthTokenServiceImpl } from "@application/features/auth/services/AuthTokenServiceImpl";
import { RegisterUserUseCaseImpl } from "@application/features/auth/usecases/RegisterUserUseCaseImpl";
import { LoginUserUseCaseImpl } from "@application/features/auth/usecases/LoginUserUseCaseImpl";
import { LogoutUserUseCaseImpl } from "@application/features/auth/usecases/LogoutUserUseCaseImpl";
import { RefreshAccessTokenUseCaseImpl } from "@application/features/auth/usecases/RefreshAccessTokenUseCaseImpl";
import { GetCurrentUserUseCaseImpl } from "@application/features/auth/usecases/GetCurrentUserUseCaseImpl";
import { CreateCampaignUseCaseImpl } from "@application/features/campaign/usecases/CreateCampaignUseCaseImpl";
import { ListMyCampaignsUseCaseImpl } from "@application/features/campaign/usecases/ListMyCampaignsUseCaseImpl";
import { DeleteCampaignUseCaseImpl } from "@application/features/campaign/usecases/DeleteCampaignUseCaseImpl";
import { CreateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CreateCharacterSheetUseCaseImpl";
import { ListMyCharacterSheetsUseCaseImpl } from "@application/features/character-sheet/usecases/ListMyCharacterSheetsUseCaseImpl";
import { DeleteCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/DeleteCharacterSheetUseCaseImpl";
import { GetCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/GetCharacterSheetUseCaseImpl";
import { UpdateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/UpdateCharacterSheetUseCaseImpl";
import { LinkCharacterToCampaignUseCaseImpl } from "@application/features/character-sheet/usecases/LinkCharacterToCampaignUseCaseImpl";
import { UnlinkCharacterFromCampaignUseCaseImpl } from "@application/features/character-sheet/usecases/UnlinkCharacterFromCampaignUseCaseImpl";
import { ListCampaignCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListCampaignCharactersUseCaseImpl";
import { ListLinkableCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl";

// Presentation — feature auth
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthRoutes } from "@presentation/http/features/auth/routes/authRoutes";
import { buildUserRoutes } from "@presentation/http/features/auth/routes/userRoutes";
// Presentation — feature campaign
import { CampaignController } from "@presentation/http/features/campaign/controllers/CampaignController";
import { CampaignCharacterController } from "@presentation/http/features/campaign/controllers/CampaignCharacterController";
import { buildCampaignRoutes } from "@presentation/http/features/campaign/routes/campaignRoutes";
// Presentation — feature character-sheet
import { CharacterSheetController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetController";
import { buildCharacterSheetRoutes } from "@presentation/http/features/character-sheet/routes/characterSheetRoutes";
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
  characterSheetRepository: CharacterSheetRepository;
  campaignCharacterRepository: CampaignCharacterRepository;
  unitOfWork: MysqlUnitOfWork;
  passwordHasher: PasswordHasherServiceImpl;
  tokenProvider: TokenProviderService;
  tokenHasher: TokenHasherServiceImpl;
  idGenerator: IdGeneratorServiceImpl;
  authTokenService: AuthTokenService;
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
  } = createAuthRepositories(connection.getPool());

  const { campaigns: campaignRepository } = createCampaignRepositories(connection.getPool());

  const {
    characterSheets: characterSheetRepository,
    campaignCharacters: campaignCharacterRepository,
  } = createCharacterSheetRepositories(connection.getPool());

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
    characterSheetRepository,
    campaignCharacterRepository,
    unitOfWork,
    passwordHasher,
    tokenProvider,
    tokenHasher,
    idGenerator,
    authTokenService,
  };
}

/**
 * Assemble le controller campaign à partir des services déjà construits.
 *
 * @param services - Les services partagés produits par {@link buildServices}.
 * @param logger - Le logger applicatif.
 * @returns Le controller campaign câblé.
 */
function buildCampaignController(services: AuthServices, logger: Logger): CampaignController {
  const createCampaign = new CreateCampaignUseCaseImpl(
    services.idGenerator,
    services.unitOfWork,
    logger,
  );
  const listMyCampaigns = new ListMyCampaignsUseCaseImpl(services.campaignRepository);
  const deleteCampaign = new DeleteCampaignUseCaseImpl(
    services.campaignRepository,
    services.unitOfWork,
    logger,
  );

  return new CampaignController(createCampaign, listMyCampaigns, deleteCampaign);
}

/**
 * Assemble le controller des fiches de personnage (CRUD des fiches).
 *
 * @param services - Les services partagés produits par {@link buildServices}.
 * @param logger - Le logger applicatif.
 * @returns Le controller fiches câblé.
 */
function buildCharacterSheetController(
  services: AuthServices,
  logger: Logger,
): CharacterSheetController {
  const createCharacterSheet = new CreateCharacterSheetUseCaseImpl(
    services.idGenerator,
    services.unitOfWork,
    logger,
  );
  const listMyCharacterSheets = new ListMyCharacterSheetsUseCaseImpl(
    services.characterSheetRepository,
  );
  const deleteCharacterSheet = new DeleteCharacterSheetUseCaseImpl(
    services.characterSheetRepository,
    services.unitOfWork,
    logger,
  );
  const getCharacterSheet = new GetCharacterSheetUseCaseImpl(
    services.characterSheetRepository,
    logger,
  );
  const updateCharacterSheet = new UpdateCharacterSheetUseCaseImpl(
    services.characterSheetRepository,
    services.unitOfWork,
    logger,
  );

  return new CharacterSheetController(
    createCharacterSheet,
    listMyCharacterSheets,
    deleteCharacterSheet,
    getCharacterSheet,
    updateCharacterSheet,
  );
}

/**
 * Assemble le controller de la liaison campagne↔fiches (rattacher/détacher/lister).
 *
 * @param services - Les services partagés produits par {@link buildServices}.
 * @param logger - Le logger applicatif.
 * @returns Le controller de liaison câblé.
 */
function buildCampaignCharacterController(
  services: AuthServices,
  logger: Logger,
): CampaignCharacterController {
  const linkCharacter = new LinkCharacterToCampaignUseCaseImpl(
    services.campaignRepository,
    services.characterSheetRepository,
    services.campaignCharacterRepository,
    services.unitOfWork,
    logger,
  );
  const unlinkCharacter = new UnlinkCharacterFromCampaignUseCaseImpl(
    services.campaignRepository,
    services.characterSheetRepository,
    services.unitOfWork,
    logger,
  );
  const listCampaignCharacters = new ListCampaignCharactersUseCaseImpl(
    services.campaignRepository,
    services.campaignCharacterRepository,
  );
  const listLinkableCharacters = new ListLinkableCharactersUseCaseImpl(
    services.campaignRepository,
    services.characterSheetRepository,
  );

  return new CampaignCharacterController(
    linkCharacter,
    unlinkCharacter,
    listCampaignCharacters,
    listLinkableCharacters,
  );
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
  readonly characterSheet: CharacterSheetController;
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
  app.use(
    "/character-sheets",
    authMiddleware,
    buildCharacterSheetRoutes(controllers.characterSheet),
  );

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

  const authController = buildAuthController(services, config, logger);
  const userController = new UserController(
    new GetCurrentUserUseCaseImpl(services.userRepository, services.credentialRepository),
  );
  const campaignController = buildCampaignController(services, logger);
  const campaignCharacterController = buildCampaignCharacterController(services, logger);
  const characterSheetController = buildCharacterSheetController(services, logger);
  const authMiddleware = buildAuthMiddleware(services.tokenProvider);

  const app = buildHttpApp(
    {
      auth: authController,
      user: userController,
      campaign: campaignController,
      campaignCharacter: campaignCharacterController,
      characterSheet: characterSheetController,
    },
    authMiddleware,
    logger,
  );

  app.listen(config.port, () => {
    logger.info("Serveur démarré", { port: config.port });
  });
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
