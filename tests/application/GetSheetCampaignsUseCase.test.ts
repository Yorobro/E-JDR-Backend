import { describe, it, expect, beforeEach } from "vitest";
import { GetSheetCampaignsUseCaseImpl } from "@application/features/character-sheet/usecases/GetSheetCampaignsUseCaseImpl";
import { CharacterSheetNotFoundError } from "@application/features/character-sheet/errors/CharacterSheetNotFoundError";
import { CharacterSheetAccessDeniedError } from "@application/features/character-sheet/errors/CharacterSheetAccessDeniedError";
import {
  FakeLogger,
  buildFakeTransactionalRepositories,
  buildTestCharacterSheet,
  buildTestCampaign,
  buildTestUser,
} from "./fakes";

describe("GetSheetCampaignsUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: GetSheetCampaignsUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new GetSheetCampaignsUseCaseImpl(txRepos.characterSheets, new FakeLogger());
  });

  it("renvoie la campagne rattachée avec le pseudo du MJ et le statut si le demandeur est propriétaire", async () => {
    txRepos.users.seed(buildTestUser("mj-1", "MJDuRoyaume"));
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1", "La Quête de l'Anneau"));
    // Modèle « une fiche = une campagne » : la fiche porte directement sa campagne (statut PENDING).
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1", "camp-1"),
    );

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      campaignId: "camp-1",
      campaignName: "La Quête de l'Anneau",
      gameMasterPseudo: "MJDuRoyaume",
      linkStatus: "PENDING",
    });
  });

  it("renvoie une liste vide si la campagne de la fiche n'existe pas (vue introuvable)", async () => {
    // La fiche pointe vers une campagne absente : la vue cross‑agrégat ne peut être projetée.
    txRepos.characterSheets.seed(
      buildTestCharacterSheet("s-1", "owner-1", "Aragorn", {}, "group-1", "camp-absente"),
    );

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "owner-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(0);
  });

  it("échoue avec CharacterSheetNotFoundError si la fiche n'existe pas", async () => {
    const result = await useCase.execute({ characterSheetId: "ghost", ownerId: "owner-1" });
    expect(result.error).toBeInstanceOf(CharacterSheetNotFoundError);
  });

  it("échoue avec CharacterSheetAccessDeniedError si le demandeur n'est pas le propriétaire", async () => {
    txRepos.characterSheets.seed(buildTestCharacterSheet("s-1", "owner-1"));

    const result = await useCase.execute({ characterSheetId: "s-1", ownerId: "autre" });

    expect(result.error).toBeInstanceOf(CharacterSheetAccessDeniedError);
  });
});
