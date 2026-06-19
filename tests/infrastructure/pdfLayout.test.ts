import PDFDocument from "pdfkit";
import { describe, it, expect } from "vitest";
import { computeColumns, formatStat, showOrDash, joinList } from "@infrastructure/pdf/pdfLayout";

describe("pdfLayout", () => {
  describe("computeColumns", () => {
    it("calcule des colonnes cohérentes basées sur la largeur de page et les marges", () => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const cols = computeColumns(doc);

      const expectedFull = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      // full.width couvre toute la zone imprimable (largeur de page - 2 * marge).
      expect(cols.full.width).toBeCloseTo(expectedFull, 5);
      expect(cols.full.x).toBeCloseTo(doc.page.margins.left, 5);
      // left.width ≈ right.width (les deux colonnes partagent la largeur, gouttière au milieu).
      expect(cols.left.width).toBeCloseTo(cols.right.width, 5);
      // La colonne de gauche commence au bord gauche imprimable.
      expect(cols.left.x).toBeCloseTo(cols.full.x, 5);
      // La colonne de droite est décalée de left.width + gutter.
      expect(cols.right.x).toBeCloseTo(cols.left.x + cols.left.width + cols.gutter, 5);
      // left + gutter + right reconstitue toute la largeur.
      expect(cols.left.width + cols.gutter + cols.right.width).toBeCloseTo(cols.full.width, 5);
      expect(cols.gutter).toBeGreaterThan(0);
    });
  });

  describe("formatStat", () => {
    it("affiche 'base (+bonus)' quand un bonus est fourni", () => {
      expect(formatStat(3, 1)).toBe("3 (+1)");
    });

    it("affiche la base seule quand il n'y a pas de bonus", () => {
      expect(formatStat(3, null)).toBe("3");
    });

    it("affiche '—' quand la base est nulle", () => {
      expect(formatStat(null, null)).toBe("—");
    });

    it("affiche '—' quand la base est nulle même si un bonus existe", () => {
      expect(formatStat(null, 2)).toBe("—");
    });
  });

  describe("showOrDash", () => {
    it("renvoie '—' pour null", () => {
      expect(showOrDash(null)).toBe("—");
    });

    it("renvoie '—' pour une chaîne vide", () => {
      expect(showOrDash("")).toBe("—");
    });

    it("renvoie la valeur formatée pour un nombre", () => {
      expect(showOrDash(7)).toBe("7");
    });

    it("renvoie la chaîne telle quelle pour un texte non vide", () => {
      expect(showOrDash("Elfe")).toBe("Elfe");
    });
  });

  describe("joinList", () => {
    it("renvoie '—' pour une liste vide", () => {
      expect(joinList([])).toBe("—");
    });

    it("joint les éléments avec ' · '", () => {
      expect(joinList(["a", "b"])).toBe("a · b");
    });
  });
});
