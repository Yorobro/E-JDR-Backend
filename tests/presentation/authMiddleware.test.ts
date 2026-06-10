import { describe, it, expect } from "vitest";
import express, { Application } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

import { buildAuthMiddleware } from "@presentation/http/middlewares/authMiddleware";
import { FakeTokenProvider } from "../application/fakes";

/**
 * Tests du middleware d'authentification, monté sur une mini-app Express.
 *
 * Le `FakeTokenProvider` encode le payload en JSON préfixé `access:` ; un cookie
 * valide est donc `access_token=access:{"userId":...,"email":...}` (URI-encodé,
 * décodé par cookie-parser).
 */
describe("buildAuthMiddleware", () => {
  function buildApp(): Application {
    const app = express();
    app.use(cookieParser());
    app.use(buildAuthMiddleware(new FakeTokenProvider()));
    app.get("/", (req, res) => {
      res.status(200).json(req.user);
    });
    return app;
  }

  function validCookie(userId: string, email: string): string {
    const token = `access:${JSON.stringify({ userId, email })}`;
    return `access_token=${encodeURIComponent(token)}`;
  }

  it("renvoie 401 UNAUTHENTICATED sans cookie access_token", async () => {
    const res = await request(buildApp()).get("/");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("renvoie 401 UNAUTHENTICATED avec un token invalide", async () => {
    const res = await request(buildApp()).get("/").set("Cookie", "access_token=garbage");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("attache req.user et laisse passer avec un token valide", async () => {
    const res = await request(buildApp())
      .get("/")
      .set("Cookie", validCookie("user-1", "me@test.com"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: "user-1", email: "me@test.com" });
  });
});
