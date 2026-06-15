import PDFDocument from "pdfkit";
import { CharacterSheetPdfGenerator } from "@application/features/character-sheet/abstractions/services/CharacterSheetPdfGenerator";
import { CharacterSheetDetail } from "@application/features/character-sheet/abstractions/usecases/CharacterSheetDetail";
import {
  buildCharacterSheetSections,
  PdfSection,
} from "@infrastructure/pdf/characterSheetPdfSections";

/**
 * Implémentation `pdfkit` du port {@link CharacterSheetPdfGenerator}.
 *
 * Rend la fiche **100 % en mémoire** : les chunks du flux pdfkit sont collectés et concaténés
 * en un `Buffer` ; aucun fichier temporaire n'est écrit. La promesse n'est résolue que sur
 * l'événement `end` (document finalisé), jamais sur `data` (chunk partiel).
 */
export class PdfKitCharacterSheetPdfGenerator implements CharacterSheetPdfGenerator {
  public generate(detail: CharacterSheetDetail): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.render(doc, detail);
      doc.end();
    });
  }

  /** Écrit le titre (nom de la fiche) puis chaque section. */
  private render(doc: PDFKit.PDFDocument, detail: CharacterSheetDetail): void {
    doc.fontSize(22).text(detail.name, { underline: true });
    doc.moveDown();
    for (const section of buildCharacterSheetSections(detail)) {
      this.renderSection(doc, section);
    }
  }

  /** Écrit l'en-tête d'une section puis ses lignes "Libellé : valeur". */
  private renderSection(doc: PDFKit.PDFDocument, section: PdfSection): void {
    doc.moveDown(0.5).fontSize(15).fillColor("#222").text(section.title);
    doc.fontSize(11).fillColor("#000");
    for (const field of section.fields) {
      doc.text(`${field.label} : ${field.value}`);
    }
  }
}
