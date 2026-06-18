import { describe, it, expect } from "vitest";
import { FriendGroupName } from "@domain/features/friend-group/value-objects/FriendGroupName";
import { InvalidFriendGroupNameError } from "@domain/features/friend-group/errors/InvalidFriendGroupNameError";

describe("FriendGroupName", () => {
  it("crée un nom valide", () => {
    const name = FriendGroupName.create("Les Aventuriers");
    expect(name.value).toBe("Les Aventuriers");
  });

  it("normalise les espaces de bord", () => {
    const name = FriendGroupName.create("  Groupe A  ");
    expect(name.value).toBe("Groupe A");
  });

  it("lève si le nom est vide", () => {
    expect(() => FriendGroupName.create("   ")).toThrow(InvalidFriendGroupNameError);
  });

  it("lève si le nom dépasse 120 caractères", () => {
    expect(() => FriendGroupName.create("a".repeat(121))).toThrow(InvalidFriendGroupNameError);
  });

  it("lève si la valeur n'est pas une string", () => {
    expect(() => FriendGroupName.create(null as unknown as string)).toThrow(
      InvalidFriendGroupNameError,
    );
  });

  it("accepte exactement 120 caractères", () => {
    const name = FriendGroupName.create("a".repeat(120));
    expect(name.value).toHaveLength(120);
  });

  it("compare deux noms égaux", () => {
    const a = FriendGroupName.create("Groupe");
    const b = FriendGroupName.create("Groupe");
    expect(a.equals(b)).toBe(true);
  });

  it("compare deux noms différents", () => {
    const a = FriendGroupName.create("Groupe A");
    const b = FriendGroupName.create("Groupe B");
    expect(a.equals(b)).toBe(false);
  });
});
