import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

/**
 * Tests d'intégration HTTP de la feature référence (catalogue + liaison N‑N + N‑1 via fiche).
 *
 * Montent la pile Express réelle (via {@link buildTestApp}) avec des doublures en mémoire.
 * Authentification réelle : on s'inscrit pour obtenir une session, puis on agit sur `/reference`
 * et `/character-sheets`. L'identité (propriétaire) vient toujours de la session.
 */
describe("Reference routes (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  async function authenticate(
    email = "joueur@test.com",
  ): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, pseudo: "Joueur", password: "password123" });
    return agent;
  }

  it("POST /reference/armes crée une arme (201) puis GET la liste", async () => {
    const agent = await authenticate();

    const created = await agent.post("/reference/armes").send({ name: "Épée longue" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Épée longue" });

    const list = await agent.get("/reference/armes");
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].name).toBe("Épée longue");
  });

  it("POST /reference/armes avec un nom vide renvoie 400 (INVALID_REFERENCE_NAME)", async () => {
    const agent = await authenticate();
    const res = await agent.post("/reference/armes").send({ name: "   " });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_REFERENCE_NAME");
  });

  it("POST /reference/armes refuse un doublon de nom (409)", async () => {
    const agent = await authenticate();
    await agent.post("/reference/armes").send({ name: "Dague" });
    const dup = await agent.post("/reference/armes").send({ name: "Dague" });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("REFERENCE_NAME_ALREADY_USED");
  });

  it("ne liste que mes éléments (isolation par propriétaire)", async () => {
    const me = await authenticate("me@test.com");
    await me.post("/reference/armes").send({ name: "Mon arme" });
    const other = await authenticate("other@test.com");
    await other.post("/reference/armes").send({ name: "Son arme" });

    const list = await me.get("/reference/armes");
    expect(list.body.items.map((i: { name: string }) => i.name)).toEqual(["Mon arme"]);
  });

  it("cycle de liaison N‑N : créer une fiche + une arme, lier, lister, délier", async () => {
    const agent = await authenticate();
    const sheet = await agent.post("/character-sheets").send({ name: "Aragorn" });
    const sheetId = sheet.body.id as string;
    const arme = await agent.post("/reference/armes").send({ name: "Andúril" });
    const armeId = arme.body.id as string;

    const link = await agent.post(`/character-sheets/${sheetId}/armes`).send({ itemId: armeId });
    expect(link.status).toBe(201);

    const linked = await agent.get(`/character-sheets/${sheetId}/armes`);
    expect(linked.status).toBe(200);
    expect(linked.body.items).toHaveLength(1);
    expect(linked.body.items[0].name).toBe("Andúril");

    const unlink = await agent.delete(`/character-sheets/${sheetId}/armes/${armeId}`);
    expect(unlink.status).toBe(204);

    const after = await agent.get(`/character-sheets/${sheetId}/armes`);
    expect(after.body.items).toHaveLength(0);
  });

  it("liaison N‑1 : affecter une formation via PUT /character-sheets/:id (formationId)", async () => {
    const agent = await authenticate();
    const sheet = await agent.post("/character-sheets").send({ name: "Aragorn" });
    const sheetId = sheet.body.id as string;
    const formation = await agent.post("/reference/formations").send({ name: "Rôdeur" });
    const formationId = formation.body.id as string;

    const updated = await agent
      .put(`/character-sheets/${sheetId}`)
      .send({ name: "Aragorn", formationId });
    expect(updated.status).toBe(200);
    expect(updated.body.formationId).toBe(formationId);
  });

  it("PUT avec une formation d'un autre utilisateur renvoie 404 (REFERENCE_ITEM_NOT_FOUND)", async () => {
    const me = await authenticate("me@test.com");
    const sheet = await me.post("/character-sheets").send({ name: "Aragorn" });
    const sheetId = sheet.body.id as string;

    const other = await authenticate("other@test.com");
    const formation = await other.post("/reference/formations").send({ name: "Mage" });
    const foreignFormationId = formation.body.id as string;

    const res = await me
      .put(`/character-sheets/${sheetId}`)
      .send({ name: "Aragorn", formationId: foreignFormationId });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("REFERENCE_ITEM_NOT_FOUND");
  });

  it("POST /reference/armes sans cookie renvoie 401 (UNAUTHENTICATED)", async () => {
    const res = await request(app).post("/reference/armes").send({ name: "Anonyme" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
