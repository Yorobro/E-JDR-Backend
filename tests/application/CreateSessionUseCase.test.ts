import { describe, it, expect, beforeEach } from "vitest";
import { CreateSessionUseCaseImpl } from "@application/features/session/usecases/CreateSessionUseCaseImpl";
import { CampaignNotFoundError } from "@application/features/campaign/errors/CampaignNotFoundError";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
} from "./fakes";

describe("CreateSessionUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: CreateSessionUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new CreateSessionUseCaseImpl(
      txRepos.campaigns,
      new FakeIdGenerator(),
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  });

  it("crée une session quand le demandeur est le MJ de la campagne", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "mj-1",
      title: "  Le réveil du dragon  ",
      date: "2026-06-20",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.title).toBe("Le réveil du dragon"); // normalisé (trim)
    expect(result.value.campaignId).toBe("camp-1");
    expect(result.value.date).toBe("2026-06-20");

    const stored = await txRepos.sessions.findByCampaignId("camp-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.title.value).toBe("Le réveil du dragon");
  });

  it("échoue (404) si la campagne n'existe pas", async () => {
    const result = await useCase.execute({
      campaignId: "ghost",
      actorUserId: "mj-1",
      title: "Session",
      date: "2026-06-20",
    });

    expect(result.error).toBeInstanceOf(CampaignNotFoundError);
    expect(await txRepos.sessions.findByCampaignId("ghost")).toHaveLength(0);
  });

  it("échoue (403) si le demandeur n'est pas le MJ de la campagne", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "autre",
      title: "Session",
      date: "2026-06-20",
    });

    expect(result.error).toBeInstanceOf(CampaignAccessDeniedError);
    expect(await txRepos.sessions.findByCampaignId("camp-1")).toHaveLength(0);
  });

  it("échoue (INVALID_SESSION_TITLE) si le titre est vide", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "mj-1",
      title: "   ",
      date: "2026-06-20",
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_SESSION_TITLE");
  });

  it("échoue (INVALID_SESSION_DATE) si la date est mal formée", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));

    const result = await useCase.execute({
      campaignId: "camp-1",
      actorUserId: "mj-1",
      title: "Session",
      date: "20/06/2026",
    });

    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_SESSION_DATE");
  });
});
