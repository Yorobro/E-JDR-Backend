import { DomainError } from "@domain/shared/errors/DomainError";

/**
 * Erreur domaine levée lorsqu'un mot de passe en clair ne respecte pas la
 * politique de robustesse minimale exigée par le métier.
 *
 * Émise lors de la validation d'un mot de passe avant son hachage.
 */
export class WeakPasswordError extends DomainError {
  /**
   * @param reason - Raison lisible expliquant pourquoi le mot de passe est rejeté.
   */
  constructor(reason: string) {
    super("WEAK_PASSWORD", `Le mot de passe est trop faible : ${reason}`);
  }
}


