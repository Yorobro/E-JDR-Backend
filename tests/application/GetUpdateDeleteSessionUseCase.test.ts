import { describe, it, expect, beforeEach } from "vitest";
import { GetSessionUseCaseImpl } from "@application/features/session/usecases/GetSessionUseCaseImpl";
import { UpdateSessionUseCaseImpl } from "@application/features/session/usecases/UpdateSessionUseCaseImpl";
import { DeleteSessionUseCaseImpl } from "@application/features/session/usecases/DeleteSessionUseCaseImpl";
import { SessionNotFoundError } from "@application/features/session/errors/SessionNotFoundError";
import { CampaignAccessDeniedError } from "@application/features/campaign/errors/CampaignAccessDeniedError";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import {
  FakeLogger,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
  buildTestCampaign,
  buildTestSession,
} from "./fakes";

describe("GetSessionUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: GetSessionUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new GetSessionUseCaseImpl(txRepos.sessions, txRepos.campaigns);
  });

  it("retourne la session pour le MJ de la campagne parente", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1", "Intro", "2026-06-20"));

    const result = await useCase.execute({ sessionId: "s-1", actorUserId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(result.value.title).toBe("Intro");
    expect(result.value.date).toBe("2026-06-20");
  });

  it("échoue (404) si la session n'existe pas", async () => {
    const result = await useCase.execute({ sessionId: "ghost", actorUserId: "mj-1" });
    expect(result.error).toBeInstanceOf(SessionNotFoundError);
  });

  it("échoue (403) si le demandeur n'est pas le MJ de la campagne parente", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1"));
    const result = await useCase.execute({ sessionId: "s-1", actorUserId: "autre" });
    expect(result.error).toBeInstanceOf(CampaignAccessDeniedError);
  });
});

describe("UpdateSessionUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: UpdateSessionUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new UpdateSessionUseCaseImpl(
      txRepos.sessions,
      txRepos.campaigns,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  });

  it("met à jour le titre et la date pour le MJ", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1", "Avant", "2026-06-20"));

    const result = await useCase.execute({
      sessionId: "s-1",
      actorUserId: "mj-1",
      title: "Après",
      date: "2026-07-01",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.title).toBe("Après");
    expect(result.value.date).toBe("2026-07-01");

    const stored = await txRepos.sessions.findById("s-1");
    expect(stored!.title.value).toBe("Après");
  });

  it("échoue (404) si la session n'existe pas", async () => {
    const result = await useCase.execute({
      sessionId: "ghost",
      actorUserId: "mj-1",
      title: "X",
      date: "2026-07-01",
    });
    expect(result.error).toBeInstanceOf(SessionNotFoundError);
  });

  it("échoue (403) si le demandeur n'est pas le MJ", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1"));
    const result = await useCase.execute({
      sessionId: "s-1",
      actorUserId: "autre",
      title: "X",
      date: "2026-07-01",
    });
    expect(result.error).toBeInstanceOf(CampaignAccessDeniedError);
  });

  it("échoue (INVALID_SESSION_TITLE) si le nouveau titre est vide", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1"));
    const result = await useCase.execute({
      sessionId: "s-1",
      actorUserId: "mj-1",
      title: "  ",
      date: "2026-07-01",
    });
    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_SESSION_TITLE");
  });
});

describe("DeleteSessionUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: DeleteSessionUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    useCase = new DeleteSessionUseCaseImpl(
      txRepos.sessions,
      txRepos.campaigns,
      new FakeUnitOfWork(txRepos),
      new FakeLogger(),
    );
  });

  it("supprime la session pour le MJ", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1"));

    const result = await useCase.execute({ sessionId: "s-1", actorUserId: "mj-1" });

    expect(result.isSuccess).toBe(true);
    expect(await txRepos.sessions.findById("s-1")).toBeNull();
  });

  it("échoue (404) si la session n'existe pas", async () => {
    const result = await useCase.execute({ sessionId: "ghost", actorUserId: "mj-1" });
    expect(result.error).toBeInstanceOf(SessionNotFoundError);
  });

  it("échoue (403) si le demandeur n'est pas le MJ", async () => {
    txRepos.campaigns.seed(buildTestCampaign("camp-1", "mj-1"));
    txRepos.sessions.seed(buildTestSession("s-1", "camp-1"));
    const result = await useCase.execute({ sessionId: "s-1", actorUserId: "autre" });
    expect(result.error).toBeInstanceOf(CampaignAccessDeniedError);
    expect(await txRepos.sessions.findById("s-1")).not.toBeNull();
  });
});
