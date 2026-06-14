import { describe, it, expect, beforeEach } from "vitest";
import { ListMyCharacterSheetsUseCaseImpl } from "@application/features/character-sheet/usecases/ListMyCharacterSheetsUseCaseImpl";
import { ListCampaignCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListCampaignCharactersUseCaseImpl";
import { UnlinkCharacterFromCampaignUseCaseImpl } from "@application/features/character-sheet/usecases/UnlinkCharacterFromCampaignUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestCharacterSheet,
} from "./fakes";

describe("ListMyCharacterSheetsUseCaseImpl", () => {
  it("ne renvoie que les fiches du propriétaire", async () => {
    const txRepos = buildFakeTransactionalRepositories();
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "u-1", "A"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-2", "u-1", "B"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-3", "u-2", "C"));

    const result = await new ListMyCharacterSheetsUseCaseImpl(txRepos.characterSheets).execute({
      ownerId: "u-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.map((s) => s.name).sort()).toEqual(["A", "B"]);
  });
});

describe("ListCampaignCharactersUseCaseImpl", () => {
  it("renvoie les fiches rattachées à la campagne", async () => {
    const txRepos = buildFakeTransactionalRepositories();
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "p-1", "Héros"));
    await txRepos.campaignCharacters.link("camp-1", "s-1", new Date());

    const result = await new ListCampaignCharactersUseCaseImpl(
      txRepos.campaigns,
      txRepos.campaignCharacters,
    ).execute({ campaignId: "camp-1", actorUserId: "p-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.name).toBe("Héros");
  });

  it("échoue (404) si la campagne n'existe pas", async () => {
    const txRepos = buildFakeTransactionalRepositories();
    const result = await new ListCampaignCharactersUseCaseImpl(
      txRepos.campaigns,
      txRepos.campaignCharacters,
    ).execute({ campaignId: "ghost", actorUserId: "p-1" });
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });
});

describe("UnlinkCharacterFromCampaignUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: UnlinkCharacterFromCampaignUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new UnlinkCharacterFromCampaignUseCaseImpl(
      txRepos.campaigns,
      txRepos.characterSheets,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  });

  it("réussit quand le MJ détache une fiche", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "p-1"));
    await txRepos.campaignCharacters.link("camp-1", "s-1", new Date());

    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "s-1",
      actorUserId: "mj-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.campaignCharacters.existsByCampaignAndSheet("camp-1", "s-1")).toBe(false);
  });

  it("refuse 403 quand le propriétaire (non-MJ) tente de détacher", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "p-1"));
    await txRepos.campaignCharacters.link("camp-1", "s-1", new Date());

    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "s-1",
      actorUserId: "p-1",
    });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
    expect(await txRepos.campaignCharacters.existsByCampaignAndSheet("camp-1", "s-1")).toBe(true);
  });

  it("refuse 403 pour un tiers", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "p-1"));
    await txRepos.campaignCharacters.link("camp-1", "s-1", new Date());

    const result = await useCase.execute({
      campaignId: "camp-1",
      characterSheetId: "s-1",
      actorUserId: "intrus",
    });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
    expect(await txRepos.campaignCharacters.existsByCampaignAndSheet("camp-1", "s-1")).toBe(true);
  });
});
