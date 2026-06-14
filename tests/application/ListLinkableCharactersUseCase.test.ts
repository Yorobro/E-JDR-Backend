import { describe, it, expect } from "vitest";
import { ListLinkableCharactersUseCaseImpl } from "@application/features/character-sheet/usecases/ListLinkableCharactersUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  FakeCampaignRepository,
  FakeCharacterSheetRepository,
  buildTestCampaign,
  buildTestCharacterSheet,
} from "./fakes";

describe("ListLinkableCharactersUseCaseImpl", () => {
  const GM = "gm-1";
  const PLAYER = "player-1";
  const CAMPAIGN_ID = "camp-1";

  function setup() {
    const campaigns = new FakeCampaignRepository();
    const sheets = new FakeCharacterSheetRepository();
    campaigns.seed(buildTestCampaign(CAMPAIGN_ID, GM));
    const useCase = new ListLinkableCharactersUseCaseImpl(campaigns, sheets);
    return { campaigns, sheets, useCase };
  }

  it("échoue si la campagne n'existe pas", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ campaignId: "unknown", actorUserId: GM });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("refuse si le demandeur n'est pas le MJ", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ campaignId: CAMPAIGN_ID, actorUserId: PLAYER });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });

  it("renvoie les fiches des autres comptes, exclut celles du MJ", async () => {
    const { sheets, useCase } = setup();
    sheets.seed(buildTestCharacterSheet("s-player", PLAYER, "Aragorn"));
    sheets.seed(buildTestCharacterSheet("s-gm", GM, "Sauron"));
    const result = await useCase.execute({ campaignId: CAMPAIGN_ID, actorUserId: GM });
    expect(result.isSuccess).toBe(true);
    const ids = result.value.map((s) => s.id);
    expect(ids).toContain("s-player");
    expect(ids).not.toContain("s-gm");
  });

  it("exclut les fiches déjà rattachées à la campagne", async () => {
    const { sheets, useCase } = setup();
    sheets.seed(buildTestCharacterSheet("s-player", PLAYER, "Aragorn"));
    sheets.seedLink(CAMPAIGN_ID, "s-player");
    const result = await useCase.execute({ campaignId: CAMPAIGN_ID, actorUserId: GM });
    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(0);
  });
});
