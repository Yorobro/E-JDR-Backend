import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { JwtTokenProvider } from "@infrastructure/security/JwtTokenProvider";

/**
 * Tests du véritable adapter JWT (signature/vérification réelles avec `jsonwebtoken`).
 *
 * Couvre les invariants de sécurité : aller-retour des claims, secrets distincts
 * access/refresh, rejet d'un token falsifié/expiré, et surtout l'épinglage de
 * l'algorithme (un token signé avec un autre `alg` doit être rejeté).
 */
describe("JwtTokenProvider (adapter réel)", () => {
  const provider = new JwtTokenProvider({
    accessSecret: "access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    refreshSecret: "refresh-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    accessExpiresIn: "15m",
    refreshExpiresIn: "7d",
  });

  const payload = { userId: "user-1", email: "user@test.com" };

  it("signe puis vérifie un access token en restituant les claims", () => {
    const signed = provider.signAccessToken(payload);
    const decoded = provider.verifyAccessToken(signed.token);

    expect(decoded).toEqual(payload);
    expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("signe puis vérifie un refresh token en restituant les claims", () => {
    const signed = provider.signRefreshToken(payload);
    expect(provider.verifyRefreshToken(signed.token)).toEqual(payload);
  });

  it("rejette un refresh token vérifié avec le secret d'access (secrets distincts)", () => {
    const refresh = provider.signRefreshToken(payload);
    // Un refresh token ne doit pas passer la vérification d'access.
    expect(provider.verifyAccessToken(refresh.token)).toBeNull();
  });

  it("renvoie null pour un token falsifié", () => {
    expect(provider.verifyAccessToken("pas.un.jwt")).toBeNull();
  });

  it("renvoie null pour un token expiré", () => {
    const shortLived = new JwtTokenProvider({
      accessSecret: "access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      refreshSecret: "refresh-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      accessExpiresIn: "-1s", // déjà expiré
      refreshExpiresIn: "7d",
    });
    const expired = shortLived.signAccessToken(payload);
    expect(shortLived.verifyAccessToken(expired.token)).toBeNull();
  });

  it("rejette un token signé avec un algorithme non épinglé (anti-confusion d'algorithme)", () => {
    // Token forgé manuellement avec HS512 au lieu du HS256 épinglé.
    const forged = jwt.sign(payload, "access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa", {
      algorithm: "HS512",
    });
    expect(provider.verifyAccessToken(forged)).toBeNull();
  });

  it("renvoie null si les claims attendus sont absents", () => {
    const tokenSansClaims = jwt.sign({ foo: "bar" }, "access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa", {
      algorithm: "HS256",
    });
    expect(provider.verifyAccessToken(tokenSansClaims)).toBeNull();
  });
});

