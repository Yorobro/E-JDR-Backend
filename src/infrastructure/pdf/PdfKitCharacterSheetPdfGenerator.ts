import PDFDocument from "pdfkit";
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
import { CharacterSheetPdfReferences } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfReferences";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import {
  Columns,
  computeColumns,
  drawStatBox,
  drawTitledBox,
  formatStat,
  joinList,
  showOrDash,
} from "@infrastructure/pdf/pdfLayout";

/** Une caractéristique à afficher : libellé, clé du champ `detail`, aide de saisie. */
interface StatSpec {
  readonly label: string;
  readonly key: "dexterite" | "intelligence" | "perception" | "social" | "vigueur";
}

/** Espacement vertical entre deux blocs empilés. */
const BLOCK_GAP = 7;

/** Caractéristiques de la colonne de gauche, dans l'ordre de la maquette. */
const STATS: readonly StatSpec[] = [
  { label: "DEXTÉRITÉ", key: "dexterite" },
  { label: "INTELLIGENCE", key: "intelligence" },
  { label: "PERCEPTION", key: "perception" },
  { label: "SOCIAL", key: "social" },
  { label: "VIGUEUR", key: "vigueur" },
];

/**
 * Implémentation `pdfkit` du port {@link CharacterSheetPdfGenerator}.
 *
 * Rend la fiche **100 % en mémoire** : les chunks du flux pdfkit sont collectés et concaténés
 * en un `Buffer` ; aucun fichier temporaire n'est écrit. La promesse n'est résolue que sur
 * l'événement `end` (document finalisé), jamais sur `data` (chunk partiel).
 *
 * Mise en page « fiche de JDR » sur deux pages : identité + caractéristiques/combat + inventaire
 * (page 1), puis sorts & miracles + notes (page 2). Le dessin est délégué à `pdfLayout`.
 */
export class PdfKitCharacterSheetPdfGenerator implements CharacterSheetPdfGenerator {
  public generate(
    detail: CharacterSheetDetail,
    references: CharacterSheetPdfReferences,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.render(doc, detail, references);
      doc.end();
    });
  }

  /** Compose les deux pages de la fiche en empilant les blocs via les hauteurs retournées. */
  private render(
    doc: PDFKit.PDFDocument,
    detail: CharacterSheetDetail,
    references: CharacterSheetPdfReferences,
  ): void {
    const cols = computeColumns(doc);
    let y = this.renderHeader(doc, detail, references, cols);
    y = this.renderStatColumns(doc, detail, references, cols, y + BLOCK_GAP);
    this.renderInventory(doc, detail, references, cols, y + BLOCK_GAP);

    doc.addPage();
    this.renderSecondPage(doc, detail, cols);
  }

  /** En-tête : nom en titre puis lignes d'identité réparties sur deux colonnes. Retourne le Y final. */
  private renderHeader(
    doc: PDFKit.PDFDocument,
    detail: CharacterSheetDetail,
    references: CharacterSheetPdfReferences,
    cols: Columns,
  ): number {
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#000")
      .text(showOrDash(detail.name), cols.full.x, doc.page.margins.top, { width: cols.full.width });

    const leftLines = [
      `Formation : ${showOrDash(references.formationName)}`,
      `Niveau : ${showOrDash(detail.niveau)}`,
      `Peuple : ${showOrDash(references.peupleName)}`,
      `Sexe : ${showOrDash(detail.sexe)}`,
    ].join("\n");
    const rightLines = [
      `Taille / poids : ${showOrDash(detail.tailleEtPoids)}`,
      `Âge : ${showOrDash(detail.age)}`,
      `Apparence : ${showOrDash(detail.apparence)}`,
    ].join("\n");

    doc.moveDown(0.4);
    const identityTop = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor("#222");
    doc.text(leftLines, cols.left.x, identityTop, { width: cols.left.width });
    const leftBottom = doc.y;
    doc.text(rightLines, cols.right.x, identityTop, { width: cols.right.width });
    return Math.max(leftBottom, doc.y);
  }

  /** Colonnes caractéristiques (gauche) et combat/ressources (droite). Retourne le Y le plus bas. */
  private renderStatColumns(
    doc: PDFKit.PDFDocument,
    detail: CharacterSheetDetail,
    references: CharacterSheetPdfReferences,
    cols: Columns,
    startY: number,
  ): number {
    const leftBottom = this.renderCharacteristics(doc, detail, references, cols.left, startY);
    const rightBottom = this.renderCombat(doc, detail, cols.right, startY);
    return Math.max(leftBottom, rightBottom);
  }

  /** Colonne gauche : titre + 5 boîtes de caractéristiques + aide de répartition. */
  private renderCharacteristics(
    doc: PDFKit.PDFDocument,
    detail: CharacterSheetDetail,
    references: CharacterSheetPdfReferences,
    zone: Columns["left"],
    startY: number,
  ): number {
    let y = this.renderColumnTitle(doc, "Caractéristiques", zone, startY);
    for (const spec of STATS) {
      const bonus = references.statBonuses.find((b) => b.stat === spec.key)?.amount ?? null;
      const value = formatStat(detail[spec.key], bonus);
      y +=
        drawStatBox(doc, { x: zone.x, y, width: zone.width, label: spec.label, value, hint: "" }) +
        BLOCK_GAP;
    }
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#888")
      .text("3 points à répartir", zone.x, y, { width: zone.width });
    return doc.y;
  }

  /** Colonne droite : titre + 3 boîtes points de vie / magie / protection. */
  private renderCombat(
    doc: PDFKit.PDFDocument,
    detail: CharacterSheetDetail,
    zone: Columns["right"],
    startY: number,
  ): number {
    let y = this.renderColumnTitle(doc, "Combat / Ressources", zone, startY);
    const boxes = [
      { label: "POINTS DE VIE", value: showOrDash(detail.pointsDeVie), hint: "10 + Vigueur" },
      { label: "POINTS DE MAGIE", value: showOrDash(detail.pointsDeMagie), hint: "10 au départ" },
      { label: "PROTECTION", value: showOrDash(detail.protection), hint: "Valeur d'armure" },
    ];
    for (const box of boxes) {
      y += drawStatBox(doc, { x: zone.x, y, width: zone.width, ...box }) + BLOCK_GAP;
    }
    return y;
  }

  /** Écrit le titre d'une colonne et retourne le Y juste en dessous. */
  private renderColumnTitle(
    doc: PDFKit.PDFDocument,
    title: string,
    zone: Columns["left"],
    startY: number,
  ): number {
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#000")
      .text(title, zone.x, startY, { width: zone.width });
    return doc.y + 4;
  }

  /** Inventaire sur deux colonnes : monnaie/armes/armures à gauche, compétences/équipement à droite. */
  private renderInventory(
    doc: PDFKit.PDFDocument,
    detail: CharacterSheetDetail,
    references: CharacterSheetPdfReferences,
    cols: Columns,
    startY: number,
  ): number {
    const leftBlocks = [
      { title: "MONNAIE", body: this.formatPurse(detail) },
      { title: "ARMES", body: joinList(references.armes) },
      { title: "ARMURES", body: joinList(references.armures) },
    ];
    const rightBlocks = [
      { title: "COMPÉTENCES", body: joinList(references.competences) },
      { title: "ÉQUIPEMENT", body: joinList(references.equipements) },
    ];
    const leftBottom = this.renderBlockColumn(doc, leftBlocks, cols.left, startY);
    const rightBottom = this.renderBlockColumn(doc, rightBlocks, cols.right, startY);
    return Math.max(leftBottom, rightBottom);
  }

  /** Empile des boîtes titrées dans une zone (colonne) et retourne le Y le plus bas atteint. */
  private renderBlockColumn(
    doc: PDFKit.PDFDocument,
    blocks: readonly { title: string; body: string }[],
    zone: Columns["left"],
    startY: number,
  ): number {
    let y = startY;
    for (const block of blocks) {
      y +=
        drawTitledBox(doc, {
          x: zone.x,
          y,
          width: zone.width,
          title: block.title,
          body: block.body,
        }) + BLOCK_GAP;
    }
    return y;
  }

  /** Page 2 : blocs pleine largeur « Sorts & Miracles » et « Notes » (textes longs). */
  private renderSecondPage(
    doc: PDFKit.PDFDocument,
    detail: CharacterSheetDetail,
    cols: Columns,
  ): void {
    const { x, width } = cols.full;
    let y = doc.page.margins.top;
    y +=
      drawTitledBox(doc, {
        x,
        y,
        width,
        title: "SORTS & MIRACLES",
        body: showOrDash(detail.sortsEtMiracles),
      }) + BLOCK_GAP;
    drawTitledBox(doc, { x, y, width, title: "NOTES", body: showOrDash(detail.notes) });
  }

  /** Formate la bourse en « X PO · Y PA · Z PC », « — » si absente. */
  private formatPurse(detail: CharacterSheetDetail): string {
    const p = detail.purse;
    if (p === null) {
      return "—";
    }
    return `${p.gold} PO · ${p.silver} PA · ${p.copper} PC`;
  }
}
