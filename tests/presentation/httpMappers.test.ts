import { describe, it, expect } from "vitest";
import { CampaignHttpMapper } from "@presentation/http/features/campaign/mappers/CampaignHttpMapper";
import { ReferenceHttpMapper } from "@presentation/http/features/reference/mappers/ReferenceHttpMapper";
import { AppError } from "@application/errors/AppError";

/** Erreur factice minimale pour tester les mappers sans instancier une classe concrète. */
class StubError extends AppError {
  constructor(code: string) {
    super(code, `stub: ${code}`);
  }
}

describe("CampaignHttpMapper.statusFor", () => {
  it("retourne 403 pour NOT_GROUP_EDITOR", () => {
    expect(CampaignHttpMapper.statusFor(new StubError("NOT_GROUP_EDITOR"))).toBe(403);
  });

  it("retourne 403 pour NOT_GROUP_MEMBER", () => {
    expect(CampaignHttpMapper.statusFor(new StubError("NOT_GROUP_MEMBER"))).toBe(403);
  });

  it("retourne 403 pour NOT_GROUP_ADMIN", () => {
    expect(CampaignHttpMapper.statusFor(new StubError("NOT_GROUP_ADMIN"))).toBe(403);
  });

  it("retourne 403 pour CAMPAIGN_ACCESS_DENIED", () => {
    expect(CampaignHttpMapper.statusFor(new StubError("CAMPAIGN_ACCESS_DENIED"))).toBe(403);
  });

  it("retourne 404 pour CAMPAIGN_NOT_FOUND", () => {
    expect(CampaignHttpMapper.statusFor(new StubError("CAMPAIGN_NOT_FOUND"))).toBe(404);
  });

  it("retourne 400 pour INVALID_CAMPAIGN_NAME", () => {
    expect(CampaignHttpMapper.statusFor(new StubError("INVALID_CAMPAIGN_NAME"))).toBe(400);
  });
});

describe("ReferenceHttpMapper.statusFor", () => {
  it("retourne 403 pour NOT_GROUP_EDITOR", () => {
    expect(ReferenceHttpMapper.statusFor(new StubError("NOT_GROUP_EDITOR"))).toBe(403);
  });

  it("retourne 403 pour NOT_GROUP_MEMBER", () => {
    expect(ReferenceHttpMapper.statusFor(new StubError("NOT_GROUP_MEMBER"))).toBe(403);
  });

  it("retourne 403 pour NOT_GROUP_ADMIN", () => {
    expect(ReferenceHttpMapper.statusFor(new StubError("NOT_GROUP_ADMIN"))).toBe(403);
  });

  it("retourne 403 pour CHARACTER_SHEET_ACCESS_DENIED", () => {
    expect(ReferenceHttpMapper.statusFor(new StubError("CHARACTER_SHEET_ACCESS_DENIED"))).toBe(403);
  });

  it("retourne 409 pour REFERENCE_NAME_ALREADY_USED", () => {
    expect(ReferenceHttpMapper.statusFor(new StubError("REFERENCE_NAME_ALREADY_USED"))).toBe(409);
  });

  it("retourne 404 pour REFERENCE_ITEM_NOT_FOUND", () => {
    expect(ReferenceHttpMapper.statusFor(new StubError("REFERENCE_ITEM_NOT_FOUND"))).toBe(404);
  });
});
