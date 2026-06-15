import { describe, it, expect } from "vitest";
import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";
import { InvalidCampaignNameError } from "@domain/features/campaign/errors/InvalidCampaignNameError";

describe("CampaignName (value object)", () => {
  it("accepte un nom valide et le normalise (trim)", () => {
    const name = CampaignName.create("  La Quête du Dragon  ");
    expect(name.value).toBe("La Quête du Dragon");
  });

  it("considère deux noms identiques après normalisation comme égaux", () => {
    const a = CampaignName.create("Campagne");
    const b = CampaignName.create("  Campagne  ");
    expect(a.equals(b)).toBe(true);
  });

  it.each(["", "   ", "\t\n"])("rejette un nom vide ou uniquement des espaces : %j", (invalid) => {
    expect(() => CampaignName.create(invalid)).toThrow(InvalidCampaignNameError);
  });

  it("rejette un nom trop long (> 120 caractères)", () => {
    expect(() => CampaignName.create("a".repeat(121))).toThrow(InvalidCampaignNameError);
  });

  it("accepte un nom de exactement 120 caractères", () => {
    const name = CampaignName.create("a".repeat(120));
    expect(name.value).toHaveLength(120);
  });

  it.each([undefined, null, 42, {}])(
    "rejette une entrée non textuelle (%s) avec InvalidCampaignNameError plutôt qu'un TypeError",
    (invalid) => {
      // Garde défensive : un corps de requête vide/malformé ne doit pas provoquer de 500.
      expect(() => CampaignName.create(invalid as unknown as string)).toThrow(
        InvalidCampaignNameError,
      );
    },
  );
});
