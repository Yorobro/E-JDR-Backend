import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { SessionLobbyView } from "@application/features/session/abstractions/usecases/CreateLobbyUseCase";
import { InviteToLobbyCommand } from "@application/features/session/commands/InviteToLobbyCommand";

/**
 * Port « in » du use case « convier des joueurs à un lobby déjà ouvert ».
 *
 * Complète {@link CreateLobbyUseCase}, qui n'invite qu'à l'ouverture du salon (`PLANNED → LOBBY`) :
 * ici la session est **déjà** en `LOBBY` et son statut ne change pas, seules les participations
 * évoluent. Renvoie le lobby complet (tous les participants) pour que l'appelant remplace son
 * état d'un bloc.
 */
export interface InviteToLobbyUseCase {
  /**
   * Convie les joueurs choisis au salon d'attente : crée les invitations manquantes et réarme
   * celles qui avaient été refusées. Les joueurs déjà `INVITED` ou `ACCEPTED` sont ignorés
   * (opération idempotente).
   *
   * @param command - Session ciblée + demandeur (MJ) + joueurs à convier.
   * @returns Un `Result` portant le lobby à jour, ou un échec métier
   *          ({@link SessionNotFoundError}, {@link CampaignNotFoundError},
   *          {@link NotGroupEditorError}, {@link EmptyParticipantSelectionError},
   *          {@link ParticipantNotInGroupError}, {@link LobbyNotOpenError}).
   */
  execute(command: InviteToLobbyCommand): Promise<Result<SessionLobbyView, AppError>>;
}
