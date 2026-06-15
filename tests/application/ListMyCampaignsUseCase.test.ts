import { describe, it, expect, beforeEach } from "vitest";
import { ListMyCampaignsUseCaseImpl } from "@application/features/campaign/usecases/ListMyCampaignsUseCaseImpl";
import { FakeCampaignRepository, buildTestCampaign } from "./fakes";

describe("ListMyCampaignsUseCaseImpl", () => {
  let repo: FakeCampaignRepository;
  let useCase: ListMyCampaignsUseCaseImpl;

  beforeEach(() => {
    repo = new FakeCampaignRepository();
    useCase = new ListMyCampaignsUseCaseImpl(repo);
  });

  it("ne renvoie que les campagnes du maître du jeu demandé", async () => {
    repo.seed(buildTestCampaign("c-1", "mj-1", "Alpha"));
    repo.seed(buildTestCampaign("c-2", "mj-1", "Beta"));
    repo.seed(buildTestCampaign("c-3", "mj-2", "Gamma"));

    const result = await useCase.execute({ gameMasterId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(2);
    expect(result.value.map((c) => c.name).sort()).toEqual(["Alpha", "Beta"]);
  });

  it("renvoie une liste vide si le MJ n'a aucune campagne", async () => {
    const result = await useCase.execute({ gameMasterId: "inconnu" });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual([]);
  });

  it("projette chaque campagne en résumé (id, name string, createdAt)", async () => {
    repo.seed(buildTestCampaign("c-1", "mj-1", "Alpha"));

    const result = await useCase.execute({ gameMasterId: "mj-1" });

    expect(result.value[0]).toEqual({
      id: "c-1",
      name: "Alpha",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
  });
});
