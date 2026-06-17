import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GetSessionQuery } from "@application/features/session/query/GetSessionQuery";

/**
 * Représentation publique (lecture) d'une session.
 *
 * Partagée par les use cases get/create/update/list : forme stable renvoyée à la présentation.
 * La `date` est exposée en `YYYY-MM-DD` ; `createdAt` est une `Date` sérialisée en ISO par la
 * couche présentation.
 */
export interface SessionView {
  /** Identifiant de la session. */
  readonly id: string;
  /** Identifiant de la campagne parente. */
  readonly campaignId: string;
  /** Titre (normalisé) de la session. */
  readonly title: string;
  /** Date de la session au format `YYYY-MM-DD`. */
  readonly date: string;
  /** Date de création de l'enregistrement. */
  readonly createdAt: Date;
}

/**
 * Port « in » du use case « obtenir une session ».
 *
 * Le controller dépend de cette interface (et non de l'implémentation concrète).
 */
export interface GetSessionUseCase {
  /**
   * Récupère une session si le demandeur est le maître du jeu de la campagne parente.
   *
   * @param query - Identifiant de la session + identifiant du demandeur.
   * @returns Un `Result` de succès (la session), ou d'échec métier
   *          ({@link SessionNotFoundError} / {@link SessionAccessDeniedError}).
   */
  execute(query: GetSessionQuery): Promise<Result<SessionView, AppError>>;
}
