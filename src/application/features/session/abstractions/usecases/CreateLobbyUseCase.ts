import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { CreateLobbyCommand } from "@application/features/session/commands/CreateLobbyCommand";

/** Vue (lecture) d'un joueur invité dans le lobby. */
export interface LobbyParticipantView {
  /** Identifiant de l'utilisateur invité. */
  readonly userId: string;
  /** État de la participation (`INVITED` à l'ouverture du lobby). */
  readonly status: string;
  /** Fiche choisie par le joueur, ou `null` tant qu'il n'a pas accepté. */
  readonly characterSheetId: string | null;
}

/**
 * Vue (lecture) du lobby fraîchement ouvert : la session passée en `LOBBY` et la liste des
 * joueurs invités. Forme stable renvoyée à la présentation.
 */
export interface SessionLobbyView {
  /** Identifiant de la session. */
  readonly sessionId: string;
  /** Identifiant de la campagne parente. */
  readonly campaignId: string;
  /** Statut de la session (`LOBBY` après ouverture). */
  readonly status: string;
  /** Joueurs invités au lobby. */
  readonly participants: LobbyParticipantView[];
}

/**
 * Port « in » du use case « ouvrir le lobby d'une session ».
 *
 * Le controller dépend de cette interface (et non de l'implémentation concrète), ce qui
 * respecte l'inversion de dépendance et facilite le mock dans les tests.
 */
export interface CreateLobbyUseCase {
  /**
   * Ouvre le lobby d'une session (transition `PLANNED → LOBBY`) et invite les joueurs choisis.
   *
   * @param command - Session ciblée + demandeur (MJ) + joueurs à inviter.
   * @returns Un `Result` de succès (le lobby ouvert) ou d'échec métier
   *          ({@link SessionNotFoundError}, {@link CampaignNotFoundError},
   *          {@link NotGroupEditorError}, {@link EmptyParticipantSelectionError},
   *          {@link ParticipantNotInGroupError}, ou un statut de session invalide).
   */
  execute(command: CreateLobbyCommand): Promise<Result<SessionLobbyView, AppError>>;
}
