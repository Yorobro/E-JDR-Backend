import { FormationCompetenceLinkRepository } from "@application/features/reference/abstractions/repositories/FormationCompetenceLinkRepository";
import { FormationCompetenceLinkDao } from "@infrastructure/persistence/mysql/features/reference/dao/FormationCompetenceLinkDao";

/** Implémentation MySQL/Drizzle de la liaison N‑N formation ↔ compétences. */
export class MysqlFormationCompetenceLinkRepository implements FormationCompetenceLinkRepository {
  constructor(private readonly dao: FormationCompetenceLinkDao) {}

  public async link(formationId: string, competenceId: string, createdAt: Date): Promise<void> {
    await this.dao.insert(formationId, competenceId, createdAt);
  }

  public async findCompetenceIdsByFormation(formationId: string): Promise<string[]> {
    return this.dao.findCompetenceIdsByFormation(formationId);
  }
}
