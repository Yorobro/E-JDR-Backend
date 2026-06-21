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
import { CreateCampaignUseCaseImpl } from "@application/features/campaign/usecases/CreateCampaignUseCaseImpl";
import { ListMyCampaignsUseCaseImpl } from "@application/features/campaign/usecases/ListMyCampaignsUseCaseImpl";
import { DeleteCampaignUseCaseImpl } from "@application/features/campaign/usecases/DeleteCampaignUseCaseImpl";
import { CampaignController } from "@presentation/http/features/campaign/controllers/CampaignController";
import { CampaignCharacterController } from "@presentation/http/features/campaign/controllers/CampaignCharacterController";
import { buildSessionController } from "@presentation/http/features/session/buildSessionController";
import { buildReferenceController } from "@presentation/http/features/reference/buildReferenceController";
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
    campaignCharacterRepository: repos.campaignCharacters,
    credentialRepository: repos.credentials,
    idGenerator,
    unitOfWork,
    logger,
  });

  const campaignController = new CampaignController(
    new CreateCampaignUseCaseImpl(idGenerator, groupAccessService, unitOfWork, logger),
    new ListMyCampaignsUseCaseImpl(repos.campaigns, groupAccessService),
    new DeleteCampaignUseCaseImpl(repos.campaigns, groupAccessService, unitOfWork, logger),
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

  const realtimeNotifier = new FakeRealtimeNotifier();
  const characterSheetController = new CharacterSheetController(
    new CreateCharacterSheetUseCaseImpl(
      idGenerator,
      groupAccessService,
      unitOfWork,
      logger,
      realtimeNotifier,
    ),
    new ListMyCharacterSheetsUseCaseImpl(repos.characterSheets, groupAccessService),
    new DeleteCharacterSheetUseCaseImpl(
      repos.characterSheets,
      unitOfWork,
      logger,
      groupAccessService,
      realtimeNotifier,
    ),
    new GetCharacterSheetUseCaseImpl({
      characterSheetRepository: repos.characterSheets,
      formationRepository: repos.formations,
      peupleRepository: repos.peoples,
      competenceRepository: repos.competences,
      formationCompetenceLink: repos.formationCompetences,
      sheetArmures: repos.sheetArmures,
      groupAccessService,
      logger,
    }),
    new UpdateCharacterSheetUseCaseImpl(
      repos.characterSheets,
      repos.formations,
      repos.peoples,
      groupAccessService,
      unitOfWork,
      logger,
      realtimeNotifier,
    ),
    new GetSheetCampaignsUseCaseImpl(repos.characterSheets, repos.campaignCharacters, logger),
  );

  const characterSheetExportController = new CharacterSheetExportController(
    new ExportCharacterSheetPdfUseCaseImpl({
      characterSheetRepository: repos.characterSheets,
      pdfGenerator: new FakeCharacterSheetPdfGenerator(),
      logger,
      groupAccessService,
      formationRepository: repos.formations,
      peupleRepository: repos.peoples,
      competenceRepository: repos.competences,
      formationCompetenceLink: repos.formationCompetences,
      sheetArmes: repos.sheetArmes,
      sheetArmures: repos.sheetArmures,
      sheetCompetences: repos.sheetCompetences,
      sheetEquipements: repos.sheetEquipements,
      sheetSorts: repos.sheetSorts,
      sheetMiracles: repos.sheetMiracles,
    }),
  );

  const sessionController = buildSessionController({
    campaignRepository: repos.campaigns,
    sessionRepository: repos.sessions,
    idGenerator,
    unitOfWork,
    logger,
    groupAccessService,
  });

  const referenceController = buildReferenceController({
    characterSheetRepository: repos.characterSheets,
    references: repos,
    idGenerator,
    groupAccessService,
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
      reference: referenceController,
      group: groupController,
      invitation: invitationController,
    },
    authMiddleware,
    logger,
  );

  return { app, repos };
}
