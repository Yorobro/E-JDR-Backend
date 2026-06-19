import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";

/**
 * Tests d'intégration HTTP de l'export PDF d'une fiche (`GET /character-sheets/:id/export-pdf`),
 * pile Express réelle sur doublures (générateur PDF factice).
 *
 * Contrat « groupe d'amis » : l'export reste réservé au PROPRIÉTAIRE de la fiche (et non à tout
 * le groupe). Les fiches sont créées dans un groupe.
 */
describe("Character sheet export PDF (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  /** Inscrit un utilisateur et renvoie un agent conservant ses cookies de session. */
  async function authenticate(email: string): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app);
    await agent.post("/auth/register").send({ email, pseudo: "Gandalf", password: "password123" });
    return agent;
  }

  /** Crée un groupe et renvoie son ID. */
  async function createGroup(
    agent: ReturnType<typeof request.agent>,
    name = "Mon groupe",
  ): Promise<string> {
    const res = await agent.post("/groups").send({ name });
    return res.body.id as string;
  }

  /**
   * Fait entrer `invitee` dans le groupe `groupId` : `inviter` invite par email, `invitee`
   * accepte. Les deux utilisateurs deviennent alors membres du même groupe.
   */
  async function joinGroup(
    inviter: ReturnType<typeof request.agent>,
    groupId: string,
    invitee: ReturnType<typeof request.agent>,
    inviteeEmail: string,
  ): Promise<void> {
    const inv = await inviter.post(`/groups/${groupId}/invitations`).send({ email: inviteeEmail });
    await invitee.post(`/invitations/${inv.body.invitationId}/accept`);
  }

  /** Collecte le corps binaire de la réponse dans un `Buffer`. */
  function collectBinary(agent: ReturnType<typeof request.agent>, id: string) {
    return agent
      .get(`/character-sheets/${id}/export-pdf`)
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on("data", (c: Buffer) => chunks.push(c));
        response.on("end", () => cb(null, Buffer.concat(chunks)));
      });
  }

  it("GET /character-sheets/:id/export-pdf renvoie le PDF (200)", async () => {
    const agent = await authenticate("p@test.com");
    const groupId = await createGroup(agent);
    const created = await agent.post("/character-sheets").send({ name: "Aragorn", groupId });

    const res = await collectBinary(agent, created.body.id);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(
      'attachment; filename="fiche-aragorn.pdf"',
    );
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.toString("utf8", 0, 4)).toBe("%PDF");
  });

  it("export de la fiche d'un autre (même membre du groupe) renvoie 403", async () => {
    // L'export reste réservé au propriétaire, même pour un autre membre du groupe.
    const owner = await authenticate("owner@test.com");
    const groupId = await createGroup(owner);
    const created = await owner.post("/character-sheets").send({ name: "Privée", groupId });

    const mate = await authenticate("mate@test.com");
    await joinGroup(owner, groupId, mate, "mate@test.com");

    const res = await mate.get(`/character-sheets/${created.body.id}/export-pdf`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
  });

  it("export sans cookie renvoie 401", async () => {
    const res = await request(app).get("/character-sheets/whatever/export-pdf");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
