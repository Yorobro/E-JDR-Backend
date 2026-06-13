import { describe, it, expect, beforeEach } from "vitest";
import { CreateCampaignUseCaseImpl } from "@application/features/campaign/usecases/CreateCampaignUseCaseImpl";
import { InvalidInputError } from "@application/features/auth/errors/InvalidInputError";
import {
  FakeLogger,
  FakeIdGenerator,
  FakeUnitOfWork,
  buildFakeTransactionalRepositories,
} from "./fakes";

describe("CreateCampaignUseCaseImpl", () => {
  let txRepos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: CreateCampaignUseCaseImpl;

  beforeEach(() => {
    txRepos = buildFakeTransactionalRepositories();
    const unitOfWork = new FakeUnitOfWork(txRepos);
    useCase = new CreateCampaignUseCaseImpl(new FakeIdGenerator(), unitOfWork, new FakeLogger());
  });

  it("crée une campagne dont l'utilisateur courant est le maître du jeu", async () => {
    const result = await useCase.execute({ gameMasterId: "mj-1", name: "  Donjon  " });

    expect(result.isSuccess).toBe(true);
    // Le nom est normalisé (trim) par le value object du domaine.
    expect(result.value.name).toBe("Donjon");
    expect(typeof result.value.id).toBe("string");

    // La campagne a bien été persistée et est rattachée au bon MJ.
    const stored = await txRepos.campaigns.findByGameMasterId("mj-1");
    expect(stored).toHaveLength(1);
    expect(stored[0]!.name.value).toBe("Donjon");
  });

  it("permet à un même MJ de créer plusieurs campagnes", async () => {
    await useCase.execute({ gameMasterId: "mj-1", name: "Première" });
    await useCase.execute({ gameMasterId: "mj-1", name: "Seconde" });

    const stored = await txRepos.campaigns.findByGameMasterId("mj-1");
    expect(stored).toHaveLength(2);
  });

  it("échoue avec InvalidInputError (INVALID_CAMPAIGN_NAME) si le nom est vide", async () => {
    const result = await useCase.execute({ gameMasterId: "mj-1", name: "   " });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidInputError);
    expect(result.error.code).toBe("INVALID_CAMPAIGN_NAME");

    // Rien n'a été persisté.
    expect(await txRepos.campaigns.findByGameMasterId("mj-1")).toHaveLength(0);
  });
});
