import { describe, it, expect, beforeEach } from "vitest";
import { ListCampaignSessionsUseCaseImpl } from "@application/features/session/usecases/ListCampaignSessionsUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";
import {
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestSession,
} from "./fakes";

describe("ListCampaignSessionsUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: ListCampaignSessionsUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new ListCampaignSessionsUseCaseImpl(txRepos.campaigns, txRepos.sessions);
  });

  it("liste les sessions d'une campagne pour son MJ (de la plus récente à la plus ancienne)", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.sessions.seed(buildTestSession("s-old", "camp-1", "Ancienne", "2026-01-10"));
    txRepos.sessions.seed(buildTestSession("s-new", "camp-1", "Récente", "2026-06-20"));
    // Session d'une autre campagne : ne doit pas apparaître.
    txRepos.sessions.seed(buildTestSession("s-other", "camp-2", "Autre", "2026-05-01"));

    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.map((s) => s.id)).toEqual(["s-new", "s-old"]);
  });

  it("retourne une liste vide si la campagne n'a aucune session", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "mj-1" });
    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(0);
  });

  it("échoue (404) si la campagne n'existe pas", async () => {
    const result = await useCase.execute({ campaignId: "ghost", actorUserId: "mj-1" });
    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
  });

  it("échoue (403) si le demandeur n'est pas le MJ", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    const result = await useCase.execute({ campaignId: "camp-1", actorUserId: "autre" });
    expect(result.error).toBeInstanceOf(CampaignAccessDeniedError);
  });
});
