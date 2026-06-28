import { describe, it, expect, beforeEach } from "vitest";
import { ListPendingCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListPendingCharactersUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestCharacterSheet,
} from "./fakes";

describe("ListPendingCharactersUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: ListPendingCharactersUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new ListPendingCharactersUseCaseImpl(txRepos.campaigns, txRepos.characterSheets);
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "Donjon", "group-1"));
  });

  it("le MJ obtient les seules fiches PENDING de sa campagne", async () => {
    // Une fiche PENDING + une fiche déjà ACCEPTED (exclue) + une fiche d'une autre campagne (exclue).
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-pending", "owner-1", "Legolas", {}, "group-1", "camp-1"),
    );
    const accepted = buildTestCharacterSheet(
      "s-accepted",
      "owner-2",
      "Gimli",
      {},
      "group-1",
      "camp-1",
    ).accept();
    txRepos.characterSheets.seed(accepted);
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-other", "owner-3", "Frodon", {}, "group-1", "camp-2"),
    );

    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.map((s) => s.name)).toEqual(["Legolas"]);
  });

  it("échoue avec CharacterSheetAccessDeniedError pour un non-MJ", async () => {
    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "intrus" });
    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("échoue avec CampaignNotFoundError si la campagne n'existe pas", async () => {
    const result = await useCase.execute({ campaignId: "ghost", actorUserId: "mj-1" });
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });
});
