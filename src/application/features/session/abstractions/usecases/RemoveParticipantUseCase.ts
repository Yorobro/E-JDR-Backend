import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { SessionLobbyView } from "@application/features/session/abstractions/usecases/CreateLobbyUseCase";
import { RemoveParticipantCommand } from "@application/features/session/commands/RemoveParticipantCommand";

/**
 * Port « in » du use case « retirer un joueur d'un lobby ouvert ».
 *
 * Opération miroir de {@link InviteToLobbyUseCase} : la session reste en `LOBBY` et son statut
 * ne change pas, seule la participation disparaît. Le retrait est une **suppression dure** de
 * l'association — le MJ peut reconvier le joueur ensuite via {@link InviteToLobbyUseCase}.
 * Renvoie le lobby complet (participants restants) pour que l'appelant remplace son état d'un
 * bloc plutôt que de supprimer la ligne localement.
 */
export interface RemoveParticipantUseCase {
  /**
   * Retire la participation du joueur ciblé au salon d'attente.
   *
   * @param command - Session ciblée + demandeur (MJ) + joueur à retirer.
   * @returns Un `Result` portant le lobby à jour, ou un échec métier
   *          ({@link SessionNotFoundError}, {@link CampaignNotFoundError},
   *          {@link NotGroupEditorError}, {@link LobbyNotOpenError},
   *          {@link ParticipantNotFoundError}).
   */
  execute(command: RemoveParticipantCommand): Promise<Result<SessionLobbyView, AppError>>;
}
