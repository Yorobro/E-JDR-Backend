import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";

import { buildTestApp } from "./buildTestApp";
import {
  type Agent,
  authenticate,
  createGroup,
  joinGroup,
  createPendingSheet,
} from "./sheetTestHelpers";

/**
 * Tests d'intégration HTTP de l'export PDF d'une fiche (`GET /character-sheets/:id/export-pdf`),
 * pile Express réelle sur doublures (générateur PDF factice).
 *
 * Contrat « groupe d'amis » : l'export reste réservé au PROPRIÉTAIRE de la fiche (ou au MJ de sa
 * campagne). Les fiches sont créées dans un groupe et rattachées à une campagne (modèle « une
 * fiche = une campagne »).
 */
describe("Character sheet export PDF (intégration HTTP)", () => {
  let app: Application;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  /** Collecte le corps binaire de la réponse dans un `Buffer`. */
  function collectBinary(agent: Agent, id: string) {
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
    const agent = await authenticate(app, "p@test.com");
    const groupId = await createGroup(agent);
    const { sheet } = await createPendingSheet(app, agent, groupId, "Aragorn");

    const res = await collectBinary(agent, sheet.id);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(
      'attachment; filename="fiche-aragorn.pdf"',
    );
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.toString("utf8", 0, 4)).toBe("%PDF");
  });

  it("export de la fiche d'un autre (même membre du groupe) renvoie 403", async () => {
    // L'export reste réservé au propriétaire (ou au MJ), même pour un autre membre du groupe.
    const owner = await authenticate(app, "owner@test.com");
    const groupId = await createGroup(owner);
    const { sheet } = await createPendingSheet(app, owner, groupId, "Privée");

    const mate = await authenticate(app, "mate@test.com");
    await joinGroup(owner, groupId, mate, "mate@test.com");

    const res = await mate.get(`/character-sheets/${sheet.id}/export-pdf`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CHARACTER_SHEET_ACCESS_DENIED");
  });

  it("export sans cookie renvoie 401", async () => {
    const res = await request(app).get("/character-sheets/whatever/export-pdf");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });
});
