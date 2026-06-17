import type { Application } from "express";

import { AppConfig } from "@config/env";
import { buildHttpApp } from "../../src/main";

import { AuthTokenServiceImpl } from "@application/features/auth/services/AuthTokenServiceImpl";
import { RegisterUserUseCaseImpl } from "@application/features/auth/usecases/RegisterUserUseCaseImpl";
import { LoginUserUseCaseImpl } from "@application/features/auth/usecases/LoginUserUseCaseImpl";
import { LogoutUserUseCaseImpl } from "@application/features/auth/usecases/LogoutUserUseCaseImpl";
import { RefreshAccessTokenUseCaseImpl } from "@application/features/auth/usecases/RefreshAccessTokenUseCaseImpl";
import { GetCurrentUserUseCaseImpl } from "@application/features/auth/usecases/GetCurrentUserUseCaseImpl";
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthMiddleware } from "@presentation/http/shared/middlewares/authMiddleware";
import { CreateCampaignUseCaseImpl } from "@application/features/campaign/usecases/CreateCampaignUseCaseImpl";
import { ListMyCampaignsUseCaseImpl } from "@application/features/campaign/usecases/ListMyCampaignsUseCaseImpl";
import { DeleteCampaignUseCaseImpl } from "@application/features/campaign/usecases/DeleteCampaignUseCaseImpl";
import { CampaignController } from "@presentation/http/features/campaign/controllers/CampaignController";
import { CampaignCharacterController } from "@presentation/http/features/campaign/controllers/CampaignCharacterController";
import { buildSessionController } from "@presentation/http/features/session/buildSessionController";
import { CreateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/CreateCharacterSheetUseCaseImpl";
import { ListMyCharacterSheetsUseCaseImpl } from "@application/features/character-sheet/usecases/ListMyCharacterSheetsUseCaseImpl";
import { DeleteCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/DeleteCharacterSheetUseCaseImpl";
import { GetCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/GetCharacterSheetUseCaseImpl";
import { UpdateCharacterSheetUseCaseImpl } from "@application/features/character-sheet/usecases/UpdateCharacterSheetUseCaseImpl";
import { GetSheetCampaignsUseCaseImpl } from "@application/features/character-sheet/usecases/GetSheetCampaignsUseCaseImpl";
import { LinkCharacterToCampaignUseCaseImpl } from "@application/features/character-sheet/usecases/LinkCharacterToCampaignUseCaseImpl";
import { UnlinkCharacterFromCampaignUseCaseImpl } from "@application/features/character-sheet/usecases/UnlinkCharacterFromCampaignUseCaseImpl";
import { ListCampaignCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListCampaignCharactersUseCaseImpl";
import { ListLinkableCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl";
import { CharacterSheetController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetController";
import { ExportCharacterSheetPdfUseCaseImpl } from "@application/features/character-sheet/usecases/ExportCharacterSheetPdfUseCaseImpl";
import { CharacterSheetExportController } from "@presentation/http/features/character-sheet/controllers/CharacterSheetExportController";

import {
  buildFakeTransactionalRepositories,
  FakeUnitOfWork,
  FakeLogger,
  FakePasswordHasher,
  FakeIdGenerator,
  FakeTokenHasher,
  FakeTokenProvider,
  FakeCharacterSheetPdfGenerator,
} from "../application/fakes";

/**
 * Construit une application Express identique à la production mais câblée sur des doublures
 * en mémoire (aucune base de données ni cryptographie réelle).
 *
 * Factorise le câblage commun aux tests d'intégration HTTP (auth + campaign + character-sheet).
 *
 * @returns L'application Express et les repos fakes (pour inspection/seed dans les tests).
 */
export function buildTestApp(): {
  app: Application;
  repos: ReturnType<typeof buildFakeTransactionalRepositories>;
} {
  const repos = buildFakeTransactionalRepositories();
  const { users: userRepository, credentials: credentialRepository } = repos;
  const refreshTokenRepository = repos.refreshTokens;
  const unitOfWork = new FakeUnitOfWork(repos);
  const passwordHasher = new FakePasswordHasher();
  const idGenerator = new FakeIdGenerator();
  const tokenHasher = new FakeTokenHasher();
  const tokenProvider = new FakeTokenProvider();
  const logger = new FakeLogger();

  const authTokenService = new AuthTokenServiceImpl(
    tokenProvider,
    tokenHasher,
    idGenerator,
    refreshTokenRepository,
  );

  const authController = new AuthController(
    new RegisterUserUseCaseImpl(
      credentialRepository,
      passwordHasher,
      idGenerator,
      authTokenService,
      unitOfWork,
      logger,
    ),
    new LoginUserUseCaseImpl(
      credentialRepository,
      passwordHasher,
      authTokenService,
      unitOfWork,
      logger,
    ),
    new LogoutUserUseCaseImpl(tokenHasher, unitOfWork),
    new RefreshAccessTokenUseCaseImpl(
      userRepository,
      refreshTokenRepository,
      tokenProvider,
      tokenHasher,
      authTokenService,
      unitOfWork,
    ),
    { isProduction: false } as AppConfig,
  );

  const userController = new UserController(
    new GetCurrentUserUseCaseImpl(userRepository, credentialRepository),
  );

  const campaignController = new CampaignController(
    new CreateCampaignUseCaseImpl(idGenerator, unitOfWork, logger),
    new ListMyCampaignsUseCaseImpl(repos.campaigns),
    new DeleteCampaignUseCaseImpl(repos.campaigns, unitOfWork, logger),
  );

  const campaignCharacterController = new CampaignCharacterController(
    new LinkCharacterToCampaignUseCaseImpl(
      repos.campaigns,
      repos.characterSheets,
      repos.campaignCharacters,
      unitOfWork,
      logger,
    ),
    new UnlinkCharacterFromCampaignUseCaseImpl(
      repos.campaigns,
      repos.characterSheets,
      unitOfWork,
      logger,
    ),
    new ListCampaignCharactersUseCaseImpl(repos.campaigns, repos.campaignCharacters),
    new ListLinkableCharactersUseCaseImpl(repos.campaigns, repos.characterSheets),
  );

  const characterSheetController = new CharacterSheetController(
    new CreateCharacterSheetUseCaseImpl(idGenerator, unitOfWork, logger),
    new ListMyCharacterSheetsUseCaseImpl(repos.characterSheets),
    new DeleteCharacterSheetUseCaseImpl(repos.characterSheets, unitOfWork, logger),
    new GetCharacterSheetUseCaseImpl(repos.characterSheets, logger),
    new UpdateCharacterSheetUseCaseImpl(repos.characterSheets, unitOfWork, logger),
    new GetSheetCampaignsUseCaseImpl(repos.characterSheets, repos.campaignCharacters, logger),
  );

  const characterSheetExportController = new CharacterSheetExportController(
    new ExportCharacterSheetPdfUseCaseImpl(
      repos.characterSheets,
      new FakeCharacterSheetPdfGenerator(),
      logger,
    ),
  );

  const sessionController = buildSessionController({
    campaignRepository: repos.campaigns,
    sessionRepository: repos.sessions,
    idGenerator,
    unitOfWork,
    logger,
  });

  const authMiddleware = buildAuthMiddleware(tokenProvider);

  const app = buildHttpApp(
    {
      auth: authController,
      user: userController,
      campaign: campaignController,
      campaignCharacter: campaignCharacterController,
      session: sessionController,
      characterSheet: characterSheetController,
      characterSheetExport: characterSheetExportController,
    },
    authMiddleware,
    logger,
  );

  return { app, repos };
}
