import { describe, it, expect } from "vitest";
import { Campaign } from "@domain/features/campaign/entities/Campaign";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";

describe("Campaign (entité)", () => {
  const buildCampaign = (gameMasterId = "user-1"): Campaign =>
    Campaign.create({
      id: "campaign-1",
      groupId: "group-1",
      gameMasterId,
      name: CampaignName.create("Ma campagne"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

  it("create établit l'utilisateur fourni comme maître du jeu", () => {
    const campaign = buildCampaign("mj-42");
    expect(campaign.gameMasterId).toBe("mj-42");
  });

  it("expose le nom sous forme de value object CampaignName", () => {
    const campaign = buildCampaign();
    expect(campaign.name).toBeInstanceOf(CampaignName);
    expect(campaign.name.value).toBe("Ma campagne");
  });

  it("isGameMaster renvoie true pour le propriétaire", () => {
    const campaign = buildCampaign("mj-42");
    expect(campaign.isGameMaster("mj-42")).toBe(true);
  });

  it("isGameMaster renvoie false pour un autre utilisateur", () => {
    const campaign = buildCampaign("mj-42");
    expect(campaign.isGameMaster("autre")).toBe(false);
  });

  it("restore reconstruit fidèlement une campagne (round-trip)", () => {
    const snapshot = {
      id: "campaign-9",
      groupId: "group-9",
      gameMasterId: "mj-9",
      name: CampaignName.create("Restaurée"),
      createdAt: new Date("2026-02-03T10:00:00Z"),
    };

    const campaign = Campaign.restore(snapshot);

    expect(campaign.id).toBe("campaign-9");
    expect(campaign.gameMasterId).toBe("mj-9");
    expect(campaign.name.value).toBe("Restaurée");
    expect(campaign.createdAt.getTime()).toBe(snapshot.createdAt.getTime());
  });
});
