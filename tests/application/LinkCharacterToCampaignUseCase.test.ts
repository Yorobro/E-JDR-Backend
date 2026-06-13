import { describe, it, expect, beforeEach } from "vitest";
import { LinkCharacterToCampaignUseCaseImpl } from "@application/features/character-sheet/usecases/LinkCharacterToCampaignUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GameMasterCannotJoinOwnCampaignError } from "@application/features/character-sheet/errors/GameMasterCannotJoinOwnCampaignError";
import { SheetAlreadyInCampaignError } from "@application/features/character-sheet/errors/SheetAlreadyInCampaignError";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestCharacterSheet,
} from "./fakes";

describe("LinkCharacterToCampaignUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: LinkCharacterToCampaignUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new LinkCharacterToCampaignUseCaseImpl(
      txRepos.campaigns,
      txRepos.characterSheets,
      txRepos.campaignCharacters,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  });

  it("rattache la fiche du joueur à une campagne dont il n'est pas le MJ", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("sheet-1", "player-1"));

    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "sheet-1",
      actorUserId: "player-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.campaignCharacters.existsByCampaignAndSheet("camp-1", "sheet-1")).toBe(
      true,
    );
  });

  it("échoue (404) si la campagne n'existe pas", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("sheet-1", "player-1"));
    const result = await useCase.execute({
      campaignId: "ghost",
      characterSheetId: "sheet-1",
      actorUserId: "player-1",
    });
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue (404) si la fiche n'existe pas", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "ghost",
      actorUserId: "player-1",
    });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue (403) si le demandeur n'est pas le propriétaire de la fiche", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("sheet-1", "player-1"));
    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "sheet-1",
      actorUserId: "autre",
    });
    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("échoue (règle MJ≠joueur) si le MJ rattache une de ses fiches à SA campagne", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("sheet-1", "mj-1"));

    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "sheet-1",
      actorUserId: "mj-1",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(GameMasterCannotJoinOwnCampaignError);
    expect(await txRepos.campaignCharacters.existsByCampaignAndSheet("camp-1", "sheet-1")).toBe(
      false,
    );
  });

  it("échoue (doublon) si la fiche est déjà rattachée à la campagne", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("sheet-1", "player-1"));
    await txRepos.campaignCharacters.link("camp-1", "sheet-1", new Date());

    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "sheet-1",
      actorUserId: "player-1",
    });

    expect(result.error).toBeInstanceOf(SheetAlreadyInCampaignError);
  });
});
