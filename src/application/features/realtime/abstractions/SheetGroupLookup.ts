/**
 * Résout le groupe d'une fiche à partir de son identifiant. Interface ségrégée :
 * l'autorisateur d'abonnement `sheet:` n'a besoin que de cela, pas de tout le repo.
 */
export interface SheetGroupLookup {
  /** Renvoie le groupId de la fiche, ou null si la fiche n'existe pas. */
  groupIdOf(sheetId: string): Promise<string | null>;
}
