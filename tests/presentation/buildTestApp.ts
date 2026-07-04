import type { Application } from "express";

import { AppConfig } from "@config/env";
import { buildHttpApp } from "../../src/main";

import { AuthTokenServiceImpl } from "@application/features/auth/services/AuthTokenServiceImpl";
import { RegisterUserUseCaseImpl } from "@application/features/auth/usecases/RegisterUserUseCaseImpl";
import { LoginUserUseCaseImpl } from "@application/features/auth/usecases/LoginUserUseCaseImpl";
import { LogoutUserUseCaseImpl } from "@application/features/auth/usecases/LogoutUserUseCaseImpl";
import { RefreshAccessTokenUseCaseImpl } from "@application/features/auth/usecases/RefreshAccessTokenUseCaseImpl";
import { GetCurrentUserUseCaseImpl } from "@application/features/auth/usecases/GetCurrentUserUseCaseImpl";
import { ChangeEmailUseCaseImpl } from "@application/features/auth/usecases/ChangeEmailUseCaseImpl";
import { ChangePasswordUseCaseImpl } from "@application/features/auth/usecases/ChangePasswordUseCaseImpl";
import { AuthController } from "@presentation/http/features/auth/controllers/AuthController";
import { UserController } from "@presentation/http/features/auth/controllers/UserController";
import { buildAuthMiddleware } from "@presentation/http/shared/middlewares/authMiddleware";
import {
  buildCampaignController,
  buildCampaignCharacterController,
} from "@presentation/http/features/campaign/buildCampaignControllers";
import { buildSessionController } from "@presentation/http/features/session/buildSessionController";
import { buildReferenceController } from "@presentation/http/features/reference/buildReferenceController";
import {
  buildCharacterSheetController,
  buildCharacterSheetExportController,
} from "@presentation/http/features/character-sheet/buildCharacterSheetControllers";

import {
  buildFakeTransactionalRepositories,
  FakeUnitOfWork,
  FakeLogger,
  FakePasswordHasher,
  FakeIdGenerator,
  FakeTokenHasher,
  FakeTokenProvider,
  FakeCharacterSheetPdfGenerator,
  FakeRealtimeNotifier,
} from "../application/fakes";
import { buildGroupControllers } from "@presentation/http/features/friend-group/buildGroupControllers";

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
  const realtimeNotifier = new FakeRealtimeNotifier();

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
    ),
    { isProduction: false } as AppConfig,
  );

  const userController = new UserController(
    new GetCurrentUserUseCaseImpl(userRepository, credentialRepository),
    new ChangeEmailUseCaseImpl(credentialRepository, unitOfWork),
    new ChangePasswordUseCaseImpl(credentialRepository, passwordHasher, unitOfWork),
  );

  // Group controllers sont construits en premier pour exposer groupAccessService.
  const {
    group: groupController,
    invitation: invitationController,
    groupAccessService,
  } = buildGroupControllers({
    friendGroupRepository: repos.friendGroups,
    groupMemberRepository: repos.groupMembers,
    groupInvitationRepository: repos.groupInvitations,
    campaignRepository: repos.campaigns,
    characterSheetRepository: repos.characterSheets,
    credentialRepository: repos.credentials,
    idGenerator,
    unitOfWork,
    logger,
    realtimeNotifier,
  });

  // Dépendances campagne (créer / lister / supprimer + personnages de campagne).
  const campaignDeps = {
    campaignRepository: repos.campaigns,
    characterSheetRepository: repos.characterSheets,
    groupAccessService,
    idGenerator,
    unitOfWork,
    logger,
    realtimeNotifier,
  };
  const campaignController = buildCampaignController(campaignDeps);
  const campaignCharacterController = buildCampaignCharacterController(campaignDeps);

  // Dépendances fiches (CRUD + copie + export PDF), assemblées via les builders réels de `main.ts`.
  const characterSheetDeps = {
    characterSheetRepository: repos.characterSheets,
    campaignRepository: repos.campaigns,
    formationRepository: repos.formations,
    peupleRepository: repos.peoples,
    competenceRepository: repos.competences,
    formationCompetenceLinkRepository: repos.formationCompetences,
    sheetArmesRepository: repos.sheetArmes,
    sheetArmuresRepository: repos.sheetArmures,
    sheetCompetencesRepository: repos.sheetCompetences,
    sheetEquipementsRepository: repos.sheetEquipements,
    sheetSortsRepository: repos.sheetSorts,
    sheetMiraclesRepository: repos.sheetMiracles,
    groupAccessService,
    pdfGenerator: new FakeCharacterSheetPdfGenerator(),
    idGenerator,
    unitOfWork,
    logger,
    realtimeNotifier,
  };
  const characterSheetController = buildCharacterSheetController(characterSheetDeps);
  const characterSheetExportController = buildCharacterSheetExportController(characterSheetDeps);

  const sessionController = buildSessionController({
    campaignRepository: repos.campaigns,
    sessionRepository: repos.sessions,
    idGenerator,
    unitOfWork,
    logger,
    groupAccessService,
    realtimeNotifier,
  });

  const referenceController = buildReferenceController({
    characterSheetRepository: repos.characterSheets,
    references: repos,
    idGenerator,
    groupAccessService,
    unitOfWork,
    logger,
    realtimeNotifier,
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
      reference: referenceController,
      group: groupController,
      invitation: invitationController,
    },
    authMiddleware,
    logger,
  );

  return { app, repos };
}
