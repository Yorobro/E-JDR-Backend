/**
 * Port « out » de la **liaison N‑N formation ↔ compétences** (table de jointure
 * `formation_competences`). Une formation peut référencer plusieurs compétences du catalogue de
 * son groupe ; chaque ligne associe `formation_id` à `competence_id`.
 *
 * Contrairement aux liaisons fiche ↔ éléments, on ne manipule ici que des **identifiants** de
 * compétences (et non des entités) : la création d'une formation ne fait que poser les liens, et
 * la lecture du catalogue n'a besoin que des ids pour la vue.
 */
export interface FormationCompetenceLinkRepository {
  /**
   * Rattache une compétence à une formation.
   *
   * @param formationId - Identifiant de la formation.
   * @param competenceId - Identifiant de la compétence (du même groupe que la formation).
   * @param createdAt - Horodatage du rattachement.
   */
  link(formationId: string, competenceId: string, createdAt: Date): Promise<void>;

  /**
   * Liste les identifiants des compétences rattachées à une formation.
   *
   * @param formationId - Identifiant de la formation.
   * @returns Les identifiants des compétences liées (vide si aucune).
   */
  findCompetenceIdsByFormation(formationId: string): Promise<string[]>;
}
