/**
 * Helpers de dessin réutilisables pour le rendu PDF d'une fiche de personnage (pdfkit).
 *
 * Toutes les écritures de texte passent **toujours** une largeur (`{ width }`) : pdfkit ne
 * wrappe pas le texte sans largeur explicite. Les fonctions de dessin de boîtes calculent leur
 * hauteur via `heightOfString` **avant** de tracer le cadre et **retournent la hauteur consommée**
 * afin que l'appelant puisse empiler les blocs sans chevauchement.
 */

/** Tiret cadratin affiché à la place d'une valeur absente. */
const DASH = "—";

/** Marge interne (padding) d'une boîte encadrée, en points. */
const BOX_PADDING = 6;
/** Espace vertical entre le titre d'une boîte et son corps. */
const TITLE_GAP = 3;
/** Espace horizontal entre le libellé d'une caractéristique et sa valeur (même ligne). */
const LABEL_VALUE_GAP = 6;

/** Une zone rectangulaire de mise en page : abscisse de départ et largeur. */
export interface Zone {
  readonly x: number;
  readonly width: number;
}

/** Découpage en colonnes de la zone imprimable d'une page. */
export interface Columns {
  readonly left: Zone;
  readonly right: Zone;
  readonly full: Zone;
  readonly gutter: number;
}

/**
 * Découpe la zone imprimable de la page courante en deux colonnes de largeur égale séparées par
 * une gouttière, plus une zone pleine largeur. Tout est dérivé de `doc.page.width` et des marges.
 */
export function computeColumns(doc: PDFKit.PDFDocument): Columns {
  const { left: marginLeft, right: marginRight } = doc.page.margins;
  const fullX = marginLeft;
  const fullWidth = doc.page.width - marginLeft - marginRight;
  const gutter = 20;
  const columnWidth = (fullWidth - gutter) / 2;
  return {
    full: { x: fullX, width: fullWidth },
    left: { x: fullX, width: columnWidth },
    right: { x: fullX + columnWidth + gutter, width: columnWidth },
    gutter,
  };
}

/** Renvoie une représentation imprimable d'une valeur scalaire, `"—"` si null/vide. */
export function showOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return DASH;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : DASH;
}

/** Joint une liste d'éléments en `"a · b · c"`, `"—"` si la liste est vide. */
export function joinList(items: string[]): string {
  return items.length > 0 ? items.join(" · ") : DASH;
}

/** Formate une caractéristique : `"3 (+1)"` avec bonus, `"3"` sans, `"—"` si base nulle. */
export function formatStat(base: number | null, bonus: number | null): string {
  if (base === null) {
    return DASH;
  }
  return bonus !== null ? `${base} (+${bonus})` : String(base);
}

/** Paramètres d'une boîte titrée pleine largeur (titre en gras + corps de texte). */
export interface TitledBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly title: string;
  readonly body: string;
}

/**
 * Dessine une boîte encadrée avec un titre en gras et un corps de texte multi-lignes.
 *
 * La hauteur du cadre est calculée **avant** le tracé (via `heightOfString` sur le corps, à la
 * largeur interne) pour que le rectangle englobe exactement le contenu. Retourne la hauteur totale
 * consommée (cadre compris), à ajouter au curseur Y de l'appelant.
 */
export function drawTitledBox(doc: PDFKit.PDFDocument, box: TitledBox): number {
  const innerWidth = box.width - 2 * BOX_PADDING;
  const titleHeight = measureBold(doc, box.title, innerWidth, 11);
  const bodyHeight = measureRegular(doc, box.body, innerWidth, 10);
  const boxHeight = BOX_PADDING * 2 + titleHeight + TITLE_GAP + bodyHeight;

  doc.rect(box.x, box.y, box.width, boxHeight).stroke();

  const textX = box.x + BOX_PADDING;
  let cursorY = box.y + BOX_PADDING;
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#000")
    .text(box.title, textX, cursorY, { width: innerWidth });
  cursorY += titleHeight + TITLE_GAP;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#000")
    .text(box.body, textX, cursorY, { width: innerWidth });

  return boxHeight;
}

/** Paramètres d'une boîte de caractéristique (label gras, valeur, aide grise). */
export interface StatBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

/**
 * Dessine la boîte d'une caractéristique : libellé en gras et valeur (déjà formatée) sur la
 * **même ligne** (libellé à gauche, valeur en gras à droite), puis une aide en petit gris
 * **seulement si elle est présente**. Hauteur calculée avant tracé ; retourne la hauteur consommée.
 */
export function drawStatBox(doc: PDFKit.PDFDocument, stat: StatBox): number {
  const innerWidth = stat.width - 2 * BOX_PADDING;
  const valueWidth = doc.font("Helvetica-Bold").fontSize(14).widthOfString(stat.value);
  const labelWidth = innerWidth - valueWidth - LABEL_VALUE_GAP;
  const labelHeight = measureBold(doc, stat.label, labelWidth, 10);
  const valueHeight = measureBold(doc, stat.value, valueWidth, 14);
  const rowHeight = Math.max(labelHeight, valueHeight);
  const hasHint = stat.hint.length > 0;
  const hintHeight = hasHint ? measureRegular(doc, stat.hint, innerWidth, 8) + TITLE_GAP : 0;
  const boxHeight = BOX_PADDING * 2 + rowHeight + hintHeight;

  doc.rect(stat.x, stat.y, stat.width, boxHeight).stroke();

  const textX = stat.x + BOX_PADDING;
  const cursorY = stat.y + BOX_PADDING;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#444")
    .text(stat.label, textX, cursorY, { width: labelWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#000")
    .text(stat.value, textX + labelWidth + LABEL_VALUE_GAP, cursorY, {
      width: valueWidth,
      align: "right",
    });
  if (hasHint) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#888")
      .text(stat.hint, textX, cursorY + rowHeight + TITLE_GAP, { width: innerWidth });
  }

  return boxHeight;
}

/** Mesure la hauteur d'un texte en gras à une police/largeur données. */
function measureBold(doc: PDFKit.PDFDocument, text: string, width: number, size: number): number {
  return doc.font("Helvetica-Bold").fontSize(size).heightOfString(text, { width });
}

/** Mesure la hauteur d'un texte normal à une police/largeur données. */
function measureRegular(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  size: number,
): number {
  return doc.font("Helvetica").fontSize(size).heightOfString(text, { width });
}
