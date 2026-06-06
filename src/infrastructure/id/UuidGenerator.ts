import { randomUUID } from "node:crypto";
import { IIdGenerator } from "@application/auth/abstractions/services/IIdGenerator";

/**
 * Implémentation du port `IIdGenerator` basée sur les **UUID v4** (`node:crypto`).
 *
 * Produit des identifiants aléatoires uniques, sans dépendance externe.
 */
export class UuidGenerator implements IIdGenerator {
  /**
   * @inheritdoc
   */
  public generate(): string {
    return randomUUID();
  }
}
