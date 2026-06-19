import { eq } from "drizzle-orm";
import { DrizzleExecutor } from "@infrastructure/persistence/drizzle/DrizzleExecutor";
import { formationCompetences } from "@infrastructure/persistence/drizzle/schema";

/**
 * DAO de la table de jointure **`formation_competences`** (liaison N‑N formation ↔ compétences).
 * Ne manipule que des identifiants : `formation_id`, `competence_id`, `created_at`.
 */
export class FormationCompetenceLinkDao {
  constructor(private readonly executor: DrizzleExecutor) {}

  public async insert(formationId: string, competenceId: string, createdAt: Date): Promise<void> {
    await this.executor.insert(formationCompetences).values({
      formation_id: formationId,
      competence_id: competenceId,
      created_at: createdAt,
    });
  }

  public async findCompetenceIdsByFormation(formationId: string): Promise<string[]> {
    const rows = await this.executor
      .select({ competenceId: formationCompetences.competence_id })
      .from(formationCompetences)
      .where(eq(formationCompetences.formation_id, formationId));
    return rows.map((row) => row.competenceId);
  }
}
