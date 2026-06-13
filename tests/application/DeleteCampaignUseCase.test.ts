import { describe, it, expect, beforeEach } from "vitest";
import { DeleteCampaignUseCaseImpl } from "@application/features/campaign/usecases/DeleteCampaignUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
} from "./fakes";

describe("DeleteCampaignUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: DeleteCampaignUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const unitOfWork = new FakeUnitOfWork(txRepos);
    useCase = new DeleteCampaignUseCaseImpl(txRepos.campaigns, unitOfWork, new FakeLogger());
  });

  it("supprime la campagne si le demandeur en est le maître du jeu", async () => {
    txRepos.campaigns.seed(buildTestCampaign("c-1", "mj-1", "À supprimer"));

    const result = await useCase.execute({ campaignId: "c-1", gameMasterId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.campaigns.findById("c-1")).toBeNull();
  });

  it("échoue avec CampaignNotFoundError si la campagne n'existe pas", async () => {
    const result = await useCase.execute({ campaignId: "inconnu", gameMasterId: "mj-1" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue avec CampaignAccessDeniedError si le demandeur n'est pas le MJ, sans supprimer", async () => {
    txRepos.campaigns.seed(buildTestCampaign("c-1", "mj-1", "Privée"));

    const result = await useCase.execute({ campaignId: "c-1", gameMasterId: "autre" });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(CampaignAccessDeniedError);
    // La campagne n'a PAS été supprimée.
    expect(await txRepos.campaigns.findById("c-1")).not.toBeNull();
  });
});
