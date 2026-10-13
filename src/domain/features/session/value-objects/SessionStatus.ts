import { InvalidSessionStatusError } from "@domain/features/session/errors/InvalidSessionStatusError";

/**
 * Value Object représentant le **statut du cycle de vie d'une session**.
 *
 * La session traverse une machine à états stricte :
 *
 * ```
 * PLANNED ──openLobby──► LOBBY ──start──► ACTIVE ──end──► ENDED
 * ```
 *
 * - `PLANNED` : session créée mais pas encore lancée (état par défaut à la création).
 * - `LOBBY`   : le MJ a ouvert le lobby et invité des joueurs ; on attend leurs réponses.
 * - `ACTIVE`  : la partie a réellement commencé (tous les joueurs présents).
 * - `ENDED`   : la session est terminée.
 *
 * Le VO encapsule uniquement la **valeur** et des prédicats de lecture ; ce sont les
 * transitions de l'entité {@link Session} (`openLobby`, `start`) qui décident quels
 * changements d'état sont autorisés. Instances figées (singletons) à la manière de `GroupRole`.
 */
export class SessionStatus {
  /** Session créée, pas encore lancée. */
  public static readonly PLANNED = new SessionStatus("PLANNED");
  /** Lobby ouvert : invitations envoyées, en attente des joueurs. */
  public static readonly LOBBY = new SessionStatus("LOBBY");
  /** Partie en cours. */
  public static readonly ACTIVE = new SessionStatus("ACTIVE");
  /** Session terminée. */
  public static readonly ENDED = new SessionStatus("ENDED");

  /**
   * @param value - La valeur symbolique du statut.
   *                Constructeur privé : on passe par {@link SessionStatus.create} ou les singletons.
   */
  private constructor(public readonly value: string) {}

  /**
   * Reconstruit un `SessionStatus` à partir de sa valeur brute (ex : colonne `sessions.status`).
   *
   * @param raw - La valeur stockée.
   * @returns Le singleton correspondant.
   * @throws {InvalidSessionStatusError} Si la valeur ne correspond à aucun statut connu.
   */
  public static create(raw: string): SessionStatus {
    switch (raw) {
      case "PLANNED":
        return SessionStatus.PLANNED;
      case "LOBBY":
        return SessionStatus.LOBBY;
      case "ACTIVE":
        return SessionStatus.ACTIVE;
      case "ENDED":
        return SessionStatus.ENDED;
      default:
        throw new InvalidSessionStatusError(raw);
    }
  }

  /** @returns `true` si la session est au statut `PLANNED`. */
  public isPlanned(): boolean {
    return this.value === "PLANNED";
  }

  /** @returns `true` si la session est au statut `LOBBY`. */
  public isLobby(): boolean {
    return this.value === "LOBBY";
  }

  /** @returns `true` si la session est au statut `ACTIVE`. */
  public isActive(): boolean {
    return this.value === "ACTIVE";
  }

  /** @returns `true` si la session est au statut `ENDED`. */
  public isEnded(): boolean {
    return this.value === "ENDED";
  }

  /**
   * Compare deux statuts par valeur (égalité structurelle).
   *
   * @param other - L'autre statut à comparer.
   * @returns `true` s'ils représentent le même statut.
   */
  public equals(other: SessionStatus): boolean {
    return this.value === other.value;
  }

  /** @returns La représentation textuelle du statut (sa valeur). */
  public toString(): string {
    return this.value;
  }
}
