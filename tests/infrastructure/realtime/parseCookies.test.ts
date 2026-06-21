import { describe, it, expect } from "vitest";
import { parseCookies } from "@infrastructure/realtime/parseCookies";

describe("parseCookies", () => {
  it("parse un en-tête Cookie en paires clé/valeur", () => {
    expect(parseCookies("access_token=abc; refresh_token=def")).toEqual({
      access_token: "abc",
      refresh_token: "def",
    });
  });

  it("gère les valeurs encodées et les espaces", () => {
    expect(parseCookies("a=%20x ; b=y")).toEqual({ a: " x", b: "y" });
  });

  it("renvoie un objet vide si l'en-tête est absent", () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies("")).toEqual({});
  });
});
