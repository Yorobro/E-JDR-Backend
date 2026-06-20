import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'une chaîne ne correspond à aucun rôle de groupe connu
 * (seuls `ADMIN` et `MEMBER` sont valides).
 *
 * Émise par le value object {@link GroupRole} lors de sa construction.
 */
export class InvalidGroupRoleError extends DomainError {
  constructor(value: string) {
    super("INVALID_GROUP_ROLE", `Rôle de groupe inconnu : "${value}".`);
  }
}
