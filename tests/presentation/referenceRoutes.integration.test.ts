import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

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

  /** Crée un groupe et renvoie son ID (l'acteur devient automatiquement admin). */
  async function createGroup(
    agent: ReturnType<typeof request.agent>,
    name = "Mon groupe",
  ): Promise<string> {
    const res = await agent.post("/groups").send({ name });
    return res.body.id as string;
  }

  it("POST /reference/armes crée une arme (201) puis GET la liste", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);

    const created = await agent.post("/reference/armes").send({ name: "Épée longue", groupId });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Épée longue" });

    const list = await agent.get(`/reference/armes?groupId=${groupId}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].name).toBe("Épée longue");
  });

  it("POST /reference/armures avec points de protection : créé (201) et renvoyé en liste", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);

    const created = await agent
      .post("/reference/armures")
      .send({ name: "Cotte de mailles", groupId, protectionPoints: 3 });
    expect(created.status).toBe(201);
    expect(created.body.protectionPoints).toBe(3);

    const list = await agent.get(`/reference/armures?groupId=${groupId}`);
    expect(list.status).toBe(200);
    expect(list.body.items[0].protectionPoints).toBe(3);
  });

  it("POST /reference/armures sans points de protection : protectionPoints null", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);

    const created = await agent.post("/reference/armures").send({ name: "Tunique", groupId });
    expect(created.status).toBe(201);
    expect(created.body.protectionPoints).toBeNull();
  });

  it("POST /reference/armes avec un nom vide renvoie 400 (INVALID_REFERENCE_NAME)", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const res = await agent.post("/reference/armes").send({ name: "   ", groupId });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_REFERENCE_NAME");
  });

  it("POST /reference/armes refuse un doublon de nom dans le même groupe (409)", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    await agent.post("/reference/armes").send({ name: "Dague", groupId });
    const dup = await agent.post("/reference/armes").send({ name: "Dague", groupId });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("REFERENCE_NAME_ALREADY_USED");
  });

  it("ne liste que les éléments du groupe (isolation par groupe)", async () => {
    const me = await authenticate("me@test.com");
    const meGroupId = await createGroup(me, "Groupe Me");
    await me.post("/reference/armes").send({ name: "Mon arme", groupId: meGroupId });

    const other = await authenticate("other@test.com");
    const otherGroupId = await createGroup(other, "Groupe Other");
    await other.post("/reference/armes").send({ name: "Son arme", groupId: otherGroupId });

    const list = await me.get(`/reference/armes?groupId=${meGroupId}`);
    expect(list.body.items.map((i: { name: string }) => i.name)).toEqual(["Mon arme"]);
  });

  it("cycle de liaison N-N : créer une fiche + une arme, lier, lister, délier", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const sheet = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });
    const sheetId = sheet.body.id as string;
    const arme = await agent.post("/reference/armes").send({ name: "Andúril", groupId });
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

  it("une armure liée remonte ses points de protection, et la fiche dérive sa protection", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const sheet = await agent.post("/character-sheets").send({ name: "Conan", groupId });
    const sheetId = sheet.body.id as string;
    const a1 = await agent
      .post("/reference/armures")
      .send({ name: "Plastron", groupId, protectionPoints: 3 });
    const a2 = await agent
      .post("/reference/armures")
      .send({ name: "Bouclier", groupId, protectionPoints: 1 });
    await agent.post(`/character-sheets/${sheetId}/armures`).send({ itemId: a1.body.id });
    await agent.post(`/character-sheets/${sheetId}/armures`).send({ itemId: a2.body.id });

    // Les armures liées exposent leurs points de protection (et non null).
    const linked = await agent.get(`/character-sheets/${sheetId}/armures`);
    const protections = linked.body.items
      .map((i: { protectionPoints: number | null }) => i.protectionPoints)
      .sort();
    expect(protections).toEqual([1, 3]);

    // La protection de la fiche est dérivée = somme des protections des armures liées.
    const detail = await agent.get(`/character-sheets/${sheetId}`);
    expect(detail.body.protection).toBe(4);
  });

  it("liaison N-1 : affecter une formation via PUT /character-sheets/:id (formationId)", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const sheet = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });
    const sheetId = sheet.body.id as string;
    const formation = await agent.post("/reference/formations").send({ name: "Rôdeur", groupId });
    const formationId = formation.body.id as string;

    const updated = await agent
      .put(`/character-sheets/${sheetId}`)
      .send({ name: "Aragorn", formationId });
    expect(updated.status).toBe(200);
    expect(updated.body.formationId).toBe(formationId);
  });

  it("PUT avec une formation d'un autre groupe renvoie 404 (REFERENCE_ITEM_NOT_FOUND)", async () => {
    const me = await authenticate("me@test.com");
    const meGroupId = await createGroup(me, "Groupe Me");
    const sheet = await me.post("/character-sheets").send({ name: "Aragorn", groupId: meGroupId });
    const sheetId = sheet.body.id as string;

    const other = await authenticate("other@test.com");
    const otherGroupId = await createGroup(other, "Groupe Other");
    const formation = await other
      .post("/reference/formations")
      .send({ name: "Mage", groupId: otherGroupId });
    const foreignFormationId = formation.body.id as string;

    // me n'est pas membre du groupe de other → 404
    const res = await me
      .put(`/character-sheets/${sheetId}`)
      .send({ name: "Aragorn", formationId: foreignFormationId });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("REFERENCE_ITEM_NOT_FOUND");

    // Utilise la variable pour éviter l'avertissement TypeScript
    void meGroupId;
  });

  it("PUT /reference/armes/:id modifie un élément et renvoie l'item (200)", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const created = await agent.post("/reference/armes").send({ name: "Épée", groupId });
    const id = created.body.id as string;

    const updated = await agent
      .put(`/reference/armes/${id}`)
      .send({ name: "Épée longue", groupId });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id, name: "Épée longue" });

    const list = await agent.get(`/reference/armes?groupId=${groupId}`);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].name).toBe("Épée longue");
  });

  it("PUT /reference/formations/:id remplace entièrement les compétences", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const c1 = await agent.post("/reference/competences").send({ name: "Escrime", groupId });
    const c2 = await agent.post("/reference/competences").send({ name: "Parade", groupId });
    const formation = await agent
      .post("/reference/formations")
      .send({ name: "Guerrier", groupId, competenceIds: [c1.body.id] });
    const formationId = formation.body.id as string;

    const updated = await agent.put(`/reference/formations/${formationId}`).send({
      name: "Maître d'armes",
      groupId,
      stat: "dexterite",
      bonus: 2,
      competenceIds: [c2.body.id],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Maître d'armes");
    expect(updated.body.stat).toBe("dexterite");
    expect(updated.body.competenceIds).toEqual([c2.body.id]);

    const list = await agent.get(`/reference/formations?groupId=${groupId}`);
    expect(list.body.items[0].competenceIds).toEqual([c2.body.id]);
  });

  it("PUT /reference/armes/:id par un non-membre du groupe renvoie 403", async () => {
    const owner = await authenticate("owner@test.com");
    const groupId = await createGroup(owner, "Groupe");
    const created = await owner.post("/reference/armes").send({ name: "Épée", groupId });
    const id = created.body.id as string;

    const intruder = await authenticate("intrus@test.com");
    const res = await intruder.put(`/reference/armes/${id}`).send({ name: "Volée", groupId });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_GROUP_MEMBER");
  });

  it("PUT /reference/armes/:id sur un id inconnu renvoie 404 (REFERENCE_ITEM_NOT_FOUND)", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const res = await agent.put("/reference/armes/inexistant").send({ name: "Fantôme", groupId });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("REFERENCE_ITEM_NOT_FOUND");
  });

  it("POST /reference/armes sans cookie renvoie 401 (UNAUTHENTICATED)", async () => {
    const res = await request(app).post("/reference/armes").send({ name: "Anonyme" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("POST /reference/sorts avec description : créé (201), renvoyé en liste", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);

    const created = await agent
      .post("/reference/sorts")
      .send({ name: "Boule de feu", groupId, description: "3d6 dégâts de feu en zone." });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: "Boule de feu",
      description: "3d6 dégâts de feu en zone.",
    });

    const list = await agent.get(`/reference/sorts?groupId=${groupId}`);
    expect(list.status).toBe(200);
    expect(list.body.items[0].description).toBe("3d6 dégâts de feu en zone.");
  });

  it("POST /reference/miracles sans description : description null", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);

    const created = await agent.post("/reference/miracles").send({ name: "Guérison", groupId });
    expect(created.status).toBe(201);
    expect(created.body.description).toBeNull();
  });

  it("PUT /reference/sorts/:id modifie la description", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const created = await agent
      .post("/reference/sorts")
      .send({ name: "Éclair", groupId, description: "Ancienne description." });
    const id = created.body.id as string;

    const updated = await agent
      .put(`/reference/sorts/${id}`)
      .send({ name: "Éclair", groupId, description: "Nouvelle description." });
    expect(updated.status).toBe(200);
    expect(updated.body.description).toBe("Nouvelle description.");
  });

  it("cycle de liaison N-N sorts : créer fiche + sort, lier, lister, délier", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const sheet = await agent.post("/character-sheets").send({ name: "Gandalf", groupId });
    const sheetId = sheet.body.id as string;
    const sort = await agent.post("/reference/sorts").send({ name: "Lumière", groupId });
    const sortId = sort.body.id as string;

    const link = await agent.post(`/character-sheets/${sheetId}/sorts`).send({ itemId: sortId });
    expect(link.status).toBe(201);

    const linked = await agent.get(`/character-sheets/${sheetId}/sorts`);
    expect(linked.status).toBe(200);
    expect(linked.body.items).toHaveLength(1);
    expect(linked.body.items[0].name).toBe("Lumière");

    const unlink = await agent.delete(`/character-sheets/${sheetId}/sorts/${sortId}`);
    expect(unlink.status).toBe(204);

    const after = await agent.get(`/character-sheets/${sheetId}/sorts`);
    expect(after.body.items).toHaveLength(0);
  });

  it("cycle de liaison N-N miracles : lier puis lister", async () => {
    const agent = await authenticate();
    const groupId = await createGroup(agent);
    const sheet = await agent.post("/character-sheets").send({ name: "Prêtresse", groupId });
    const sheetId = sheet.body.id as string;
    const miracle = await agent.post("/reference/miracles").send({ name: "Bénédiction", groupId });
    const miracleId = miracle.body.id as string;

    const link = await agent
      .post(`/character-sheets/${sheetId}/miracles`)
      .send({ itemId: miracleId });
    expect(link.status).toBe(201);

    const linked = await agent.get(`/character-sheets/${sheetId}/miracles`);
    expect(linked.body.items.map((i: { name: string }) => i.name)).toEqual(["Bénédiction"]);
  });
});
