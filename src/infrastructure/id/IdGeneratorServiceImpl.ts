import { randomUUID } from "node:crypto";
import { IdGeneratorService } from "@application/features/auth/abstractions/services/IdGeneratorService";

/**
 * Implémentation du port `IdGeneratorService` basée sur les **UUID v4** (`node:crypto`).
 *
 * Produit des identifiants aléatoires uniques, sans dépendance externe.
 */
export class IdGeneratorServiceImpl implements IdGeneratorService {
  /**
   * @inheritdoc
   */
  public generate(): string {
    return randomUUID();
  }
}
