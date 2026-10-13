import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { RespondToInvitationCommand } from "@application/features/session/commands/RespondToInvitationCommand";

/**
 * Port « in » du use case « répondre à une invitation de session » (côté joueur convié).
 *
 * Accept → la participation passe `ACCEPTED` ; refus → `REFUSED`. La transition et l'invariant
 * « on ne répond qu'une fois » sont portés par l'entité `SessionParticipant`, pas ici.
 */
export interface RespondToInvitationUseCase {
  /**
   * @param command - Session ciblée + joueur (depuis la session authentifiée) + décision.
   * @returns Un `Result` de succès (`void`) ou d'échec métier
   *          ({@link SessionNotFoundError}, {@link CampaignNotFoundError},
   *          {@link SessionNotJoinableError}, {@link ParticipantNotFoundError}, ou un statut de
   *          participation invalide si le joueur a déjà répondu).
   */
  execute(command: RespondToInvitationCommand): Promise<Result<void, AppError>>;
}
