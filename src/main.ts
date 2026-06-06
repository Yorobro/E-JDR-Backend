import express, { Application } from "express";
import cookieParser from "cookie-parser";

import { AppConfig, loadConfig } from "@config/env";

// Infrastructure
import { MysqlConnection } from "@infrastructure/persistence/mysql/MysqlConnection";
import { UserDao } from "@infrastructure/persistence/mysql/auth/dao/UserDao";
import { RefreshTokenDao } from "@infrastructure/persistence/mysql/auth/dao/RefreshTokenDao";
import { MysqlUserRepository } from "@infrastructure/persistence/mysql/auth/repository/MysqlUserRepository";
import { MysqlRefreshTokenRepository } from "@infrastructure/persistence/mysql/auth/repository/MysqlRefreshTokenRepository";
import { BcryptPasswordHasher } from "@infrastructure/security/BcryptPasswordHasher";
import { JwtTokenProvider } from "@infrastructure/security/JwtTokenProvider";
import { Sha256TokenHasher } from "@infrastructure/security/Sha256TokenHasher";
import { UuidGenerator } from "@infrastructure/id/UuidGenerator";

// Application
import { AuthTokenService } from "@application/auth/services/AuthTokenService";
import { RegisterUserUseCase } from "@application/auth/usecases/RegisterUserUseCase";
import { LoginUserUseCase } from "@application/auth/usecases/LoginUserUseCase";
import { LogoutUserUseCase } from "@application/auth/usecases/LogoutUserUseCase";
import { RefreshAccessTokenUseCase } from "@application/auth/usecases/RefreshAccessTokenUseCase";

// Presentation
import { AuthController } from "@presentation/http/controllers/AuthController";
import { buildAuthRoutes } from "@presentation/http/routes/authRoutes";
import { errorHandler } from "@presentation/http/middlewares/errorHandler";

/**
 * **Composition root** de l'application : seul endroit qui instancie les classes concrètes
 * et résout les dépendances (injection manuelle). C'est ce câblage qui rend chaque couche
 * interchangeable (DIP) : pour changer d'implémentation (ex : autre BDD), on ne touche qu'ici.
 *
 * Le flux d'assemblage suit les dépendances : infrastructure → services/use cases (application)
 * → controller/routes (présentation) → application Express.
 */

/**
 * Assemble les composants d'authentification et construit le controller correspondant.
 *
 * @param connection - La connexion MySQL partagée.
 * @param config - La configuration applicative.
 * @returns Le `AuthController` entièrement câblé.
 */
function buildAuthController(connection: MysqlConnection, config: AppConfig): AuthController {
  const pool = connection.getPool();

  // DAO (SQL pur) → repositories (assemblage + mapping)
  const userRepository = new MysqlUserRepository(new UserDao(pool));
  const refreshTokenRepository = new MysqlRefreshTokenRepository(new RefreshTokenDao(pool));

  // Adapters de sécurité / identifiants
  const passwordHasher = new BcryptPasswordHasher();
  const tokenProvider = new JwtTokenProvider({
    accessSecret: config.jwt.accessSecret,
    refreshSecret: config.jwt.refreshSecret,
    accessExpiresIn: config.jwt.accessExpiresIn,
    refreshExpiresIn: config.jwt.refreshExpiresIn,
  });
  const tokenHasher = new Sha256TokenHasher();
  const idGenerator = new UuidGenerator();

  // Service partagé d'émission des jetons
  const authTokenService = new AuthTokenService(
    tokenProvider,
    tokenHasher,
    idGenerator,
    refreshTokenRepository,
  );

  // Use cases (orchestration pure)
  const registerUser = new RegisterUserUseCase(
    userRepository,
    passwordHasher,
    idGenerator,
    authTokenService,
  );
  const loginUser = new LoginUserUseCase(userRepository, passwordHasher, authTokenService);
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
 * @param authController - Le controller d'authentification câblé.
 * @returns L'application Express prête à écouter.
 */
function buildHttpApp(authController: AuthController): Application {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use("/auth", buildAuthRoutes(authController));

  // Le middleware d'erreurs doit être enregistré en dernier.
  app.use(errorHandler);

  return app;
}

/**
 * Démarre le serveur : charge la config, ouvre la connexion BDD, assemble et écoute.
 *
 * @returns Une promesse résolue lorsque le serveur écoute.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();

  const connection = new MysqlConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
  });

  const authController = buildAuthController(connection, config);
  const app = buildHttpApp(authController);

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Serveur démarré sur le port ${config.port}`);
  });
}

void bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Échec du démarrage de l'application :", error);
  process.exit(1);
});
