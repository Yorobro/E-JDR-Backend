import express, { Application, RequestHandler } from "express";
import cookieParser from "cookie-parser";

import { AppConfig, loadConfig } from "@config/env";

// Infrastructure
import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { createAuthRepositories } from "@infrastructure/persistence/mysql/features/auth/createAuthRepositories";
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

// Presentation — feature auth
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthRoutes } from "@presentation/http/features/auth/routes/authRoutes";
import { buildUserRoutes } from "@presentation/http/features/auth/routes/userRoutes";
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
    unitOfWork,
    passwordHasher,
    tokenProvider,
    tokenHasher,
    idGenerator,
    authTokenService,
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
 * Construit l'application Express : middlewares globaux, routes, gestion d'erreurs.
 *
 * Exportée pour permettre des tests d'intégration HTTP (via supertest) qui montent la
 * pile Express réelle — routage, parsing JSON, cookies, controllers, gestion d'erreurs —
 * en injectant les controllers câblés sur des doublures, sans base de données.
 *
 * @param authController - Le controller d'authentification câblé.
 * @param userController - Le controller des routes utilisateur protégées.
 * @param authMiddleware - Le middleware de vérification du jeton d'accès.
 * @param logger - Le logger applicatif (injecté pour structurer les logs et les erreurs).
 * @returns L'application Express prête à écouter.
 */
export function buildHttpApp(
  authController: AuthController,
  userController: UserController,
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

  app.use("/auth", buildAuthRoutes(authController));
  // Routes protégées : le middleware d'auth s'applique à tout ce qui est monté derrière.
  app.use("/me", authMiddleware, buildUserRoutes(userController));

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
  const authMiddleware = buildAuthMiddleware(services.tokenProvider);

  const app = buildHttpApp(authController, userController, authMiddleware, logger);

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
