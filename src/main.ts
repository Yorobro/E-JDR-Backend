import express, { Application } from "express";
import cookieParser from "cookie-parser";

import { AppConfig, loadConfig } from "@config/env";

// Infrastructure
import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { UserDao } from "@infrastructure/persistence/mysql/auth/dao/UserDao";
import { CredentialDao } from "@infrastructure/persistence/mysql/auth/dao/CredentialDao";
import { RefreshTokenDao } from "@infrastructure/persistence/mysql/auth/dao/RefreshTokenDao";
import { MysqlUserRepository } from "@infrastructure/persistence/mysql/auth/repository/MysqlUserRepository";
import { MysqlCredentialRepository } from "@infrastructure/persistence/mysql/auth/repository/MysqlCredentialRepository";
import { MysqlRefreshTokenRepository } from "@infrastructure/persistence/mysql/auth/repository/MysqlRefreshTokenRepository";
import { MysqlUnitOfWork } from "@infrastructure/persistence/mysql/MysqlUnitOfWork";
import { BcryptPasswordHasher } from "@infrastructure/security/BcryptPasswordHasher";
import { JwtTokenProvider } from "@infrastructure/security/JwtTokenProvider";
import { Sha256TokenHasher } from "@infrastructure/security/Sha256TokenHasher";
import { UuidGenerator } from "@infrastructure/id/UuidGenerator";
import { PinoLogger } from "@infrastructure/logging/PinoLogger";

// Application
import { ILogger } from "@application/shared/ILogger";
import { AuthTokenService } from "@application/auth/services/AuthTokenService";
import { RegisterUserUseCase } from "@application/auth/usecases/RegisterUserUseCase";
import { LoginUserUseCase } from "@application/auth/usecases/LoginUserUseCase";
import { LogoutUserUseCase } from "@application/auth/usecases/LogoutUserUseCase";
import { RefreshAccessTokenUseCase } from "@application/auth/usecases/RefreshAccessTokenUseCase";

// Presentation
import { AuthController } from "@presentation/http/controllers/AuthController";
import { buildAuthRoutes } from "@presentation/http/routes/authRoutes";
import { requestIdMiddleware } from "@presentation/http/middlewares/requestIdMiddleware";
import { buildHttpLoggerMiddleware } from "@presentation/http/middlewares/httpLoggerMiddleware";
import { buildErrorHandler } from "@presentation/http/middlewares/errorHandler";

/**
 * **Composition root** de l'application : seul endroit qui instancie les classes concrètes
 * et résout les dépendances (injection manuelle). C'est ce câblage qui rend chaque couche
 * interchangeable (DIP) : pour changer d'implémentation (ex : autre BDD), on ne touche qu'ici.
 *
 * Le flux d'assemblage suit les dépendances : infrastructure → services/use cases (application)
 * → controller/routes (présentation) → application Express.
 */

function buildAuthRepositories(connection: MysqlConnection) {
  const pool = connection.getPool();
  return {
    userRepository: new MysqlUserRepository(new UserDao(pool)),
    credentialRepository: new MysqlCredentialRepository(new CredentialDao(pool)),
    refreshTokenRepository: new MysqlRefreshTokenRepository(new RefreshTokenDao(pool)),
  };
}

function buildSecurityAdapters(config: AppConfig) {
  return {
    passwordHasher: new BcryptPasswordHasher(),
    tokenProvider: new JwtTokenProvider({
      accessSecret: config.jwt.accessSecret,
      refreshSecret: config.jwt.refreshSecret,
      accessExpiresIn: config.jwt.accessExpiresIn,
      refreshExpiresIn: config.jwt.refreshExpiresIn,
    }),
    tokenHasher: new Sha256TokenHasher(),
    idGenerator: new UuidGenerator(),
  };
}

/**
 * **Composition root** du module auth : assemble repositories, adapters de sécurité,
 * services et use cases, puis retourne le controller câblé.
 */
function buildAuthController(
  connection: MysqlConnection,
  config: AppConfig,
  logger: ILogger,
): AuthController {
  const { userRepository, credentialRepository, refreshTokenRepository } =
    buildAuthRepositories(connection);
  const unitOfWork = new MysqlUnitOfWork(connection);
  const { passwordHasher, tokenProvider, tokenHasher, idGenerator } = buildSecurityAdapters(config);

  const authTokenService = new AuthTokenService(
    tokenProvider,
    tokenHasher,
    idGenerator,
    refreshTokenRepository,
  );

  const registerUser = new RegisterUserUseCase(
    credentialRepository,
    passwordHasher,
    idGenerator,
    authTokenService,
    unitOfWork,
    logger,
  );
  const loginUser = new LoginUserUseCase(
    credentialRepository,
    passwordHasher,
    authTokenService,
    unitOfWork,
    logger,
  );
  const logoutUser = new LogoutUserUseCase(refreshTokenRepository, tokenHasher);
  const refreshAccessToken = new RefreshAccessTokenUseCase(
    userRepository,
    refreshTokenRepository,
    tokenProvider,
    tokenHasher,
    authTokenService,
  );

  return new AuthController(registerUser, loginUser, logoutUser, refreshAccessToken, config);
}

/**
 * Construit l'application Express : middlewares globaux, routes, gestion d'erreurs.
 *
 * Exportée pour permettre des tests d'intégration HTTP (via supertest) qui montent la
 * pile Express réelle — routage, parsing JSON, cookies, controller, gestion d'erreurs —
 * en injectant un controller câblé sur des doublures, sans base de données.
 *
 * @param authController - Le controller d'authentification câblé.
 * @param logger - Le logger applicatif (injecté pour structurer les logs et les erreurs).
 * @returns L'application Express prête à écouter.
 */
export function buildHttpApp(authController: AuthController, logger: ILogger): Application {
  const app = express();

  // Le requestId doit être attaché en premier pour que tous les middlewares suivants
  // puissent corréler leurs logs avec l'identifiant de la requête.
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(buildHttpLoggerMiddleware(logger));

  app.use("/auth", buildAuthRoutes(authController));

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
  const app = buildHttpApp(authController, logger);

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
