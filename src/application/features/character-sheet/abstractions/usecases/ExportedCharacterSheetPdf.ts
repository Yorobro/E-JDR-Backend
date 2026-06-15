/**
 * Résultat d'un export PDF de fiche : le document binaire et le nom de fichier suggéré.
 *
 * Le `fileName` est dérivé du nom de la fiche (slugifié) côté use case, pour que la couche
 * présentation n'ait qu'à le poser dans l'en-tête `Content-Disposition`.
 */
export interface ExportedCharacterSheetPdf {
  /** Le PDF complet de la fiche, généré 100 % en mémoire. */
  readonly pdf: Buffer;
  /** Nom de fichier suggéré (ex : `fiche-aragorn.pdf`). */
  readonly fileName: string;
}
