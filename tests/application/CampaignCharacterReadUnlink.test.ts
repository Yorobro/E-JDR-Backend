import { describe, it, expect, beforeEach } from "vitest";
import { ListMyCharacterSheetsUseCaseImpl } from "@application/features/character-sheet/usecases/ListMyCharacterSheetsUseCaseImpl";
import { ListCampaignCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListCampaignCharactersUseCaseImpl";
import { UnlinkCharacterFromCampaignUseCaseImpl } from "@application/features/character-sheet/usecases/UnlinkCharacterFromCampaignUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { NotGroupMemberError } from "@application/features/friend-group/errors/NotGroupMemberError";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestCharacterSheet,
  buildTestMembership,
} from "./fakes";

describe("ListMyCharacterSheetsUseCaseImpl", () => {
  const buildUseCase = (txRepos: ReturnType<typeof buildFakeTransactionalRepositories>) =>
    new ListMyCharacterSheetsUseCaseImpl(
      txRepos.characterSheets,
      new GroupAccessServiceImpl(
        txRepos.groupMembers,
        txRepos.campaigns,
        txRepos.campaignCharacters,
      ),
    );

  it("ne renvoie que MES fiches du groupe actif (pas celles des autres membres ni d'un autre groupe)", async () => {
    const txRepos = buildFakeTransactionalRepositories();
    // u-1 a "A" dans group-1 et "C" dans group-2 ; u-2 a "B" dans group-1.
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "u-1", "A", {}, "group-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-2", "u-2", "B", {}, "group-1"));
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-3", "u-1", "C", {}, "group-2"));
    txRepos.groupMembers.seed(buildTestMembership({ groupId: "group-1", userId: "u-1" }));

    const result = await buildUseCase(txRepos).execute({ userId: "u-1", groupId: "group-1" });

    expect(result.isSuccess).toBe(true);
    // Seule "A" : "B" appartient à un autre membre, "C" est dans un autre groupe.
    expect(result.value.map((s) => s.name).sort()).toEqual(["A"]);
  });

  it("échoue avec NOT_GROUP_MEMBER si le demandeur n'est pas membre du groupe", async () => {
    const txRepos = buildFakeTransactionalRepositories();
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "u-1", "A", {}, "group-1"));

    const result = await buildUseCase(txRepos).execute({ userId: "etranger", groupId: "group-1" });

    expect(result.error).toBeInstanceOf(NotGroupMemberError);
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
