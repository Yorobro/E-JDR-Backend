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

// Application
import { Logger } from "@application/shared/Logger";
import { AuthTokenServiceImpl } from "@application/features/auth/services/AuthTokenServiceImpl";
import { RegisterUserUseCaseImpl } from "@application/features/auth/usecases/RegisterUserUseCaseImpl";
import { LoginUserUseCaseImpl } from "@application/features/auth/usecases/LoginUserUseCaseImpl";
import { LogoutUserUseCaseImpl } from "@application/features/auth/usecases/LogoutUserUseCaseImpl";
import { RefreshAccessTokenUseCaseImpl } from "@application/features/auth/usecases/RefreshAccessTokenUseCaseImpl";
import { GetCurrentUserUseCaseImpl } from "@application/features/auth/usecases/GetCurrentUserUseCaseImpl";

// Presentation
import { AuthController } from "@presentation/http/controllers/AuthController";
import { UserController } from "@presentation/http/controllers/UserController";
import { buildAuthRoutes } from "@presentation/http/routes/authRoutes";
import { buildUserRoutes } from "@presentation/http/routes/userRoutes";
import { requestIdMiddleware } from "@presentation/http/middlewares/requestIdMiddleware";
import { buildHttpLoggerMiddleware } from "@presentation/http/middlewares/httpLoggerMiddleware";
import { buildErrorHandler } from "@presentation/http/middlewares/errorHandler";
import { buildAuthMiddleware } from "@presentation/http/middlewares/authMiddleware";

/**
 * **Composition root** de l'application : seul endroit qui instancie les classes concrètes
 * et résout les dépendances (injection manuelle). C'est ce câblage qui rend chaque couche
 * interchangeable (DIP) : pour changer d'implémentation (ex : autre BDD), on ne touche qu'ici.
 *
 * Le flux d'assemblage suit les dépendances : infrastructure → services/use cases (application)
 * → controller/routes (présentation) → application Express.
 */

function buildSecurityAdapters(config: AppConfig) {
  return {
    passwordHasher: new PasswordHasherServiceImpl(),
    tokenProvider: new TokenProviderServiceImpl({
      accessSecret: config.jwt.accessSecret,
      refreshSecret: config.jwt.refreshSecret,
      accessExpiresIn: config.jwt.accessExpiresIn,
      refreshExpiresIn: config.jwt.refreshExpiresIn,
    }),
    tokenHasher: new TokenHasherServiceImpl(),
    idGenerator: new IdGeneratorServiceImpl(),
  };
}

/**
 * **Composition root** du module auth : assemble repositories, adapters de sécurité,
 * services et use cases, puis retourne le controller câblé.
 */
function buildAuthController(
  connection: MysqlConnection,
  config: AppConfig,
  logger: Logger,
): AuthController {
  const {
    users: userRepository,
    credentials: credentialRepository,
    refreshTokens: refreshTokenRepository,
  } = createAuthRepositories(connection.getPool());
  const unitOfWork = new MysqlUnitOfWork(connection);
  const { passwordHasher, tokenProvider, tokenHasher, idGenerator } = buildSecurityAdapters(config);

  const authTokenService = new AuthTokenServiceImpl(
    tokenProvider,
    tokenHasher,
    idGenerator,
    refreshTokenRepository,
  );

  const registerUser = new RegisterUserUseCaseImpl(
    credentialRepository,
    passwordHasher,
    idGenerator,
    authTokenService,
    unitOfWork,
    logger,
  );
  const loginUser = new LoginUserUseCaseImpl(
    credentialRepository,
    passwordHasher,
    authTokenService,
    unitOfWork,
    logger,
  );
  const logoutUser = new LogoutUserUseCaseImpl(tokenHasher, unitOfWork);
  const refreshAccessToken = new RefreshAccessTokenUseCaseImpl(
    userRepository,
    refreshTokenRepository,
    tokenProvider,
    tokenHasher,
    authTokenService,
    unitOfWork,
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

  const authController = buildAuthController(connection, config, logger);

  // buildSecurityAdapters et createAuthRepositories sont sans état — les rappeler ici
  // est sans effet de bord et évite de changer la signature de buildAuthController.
  const { tokenProvider } = buildSecurityAdapters(config);
  const { users, credentials } = createAuthRepositories(connection.getPool());
  const userController = new UserController(new GetCurrentUserUseCaseImpl(users, credentials));
  const authMiddleware = buildAuthMiddleware(tokenProvider);

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
