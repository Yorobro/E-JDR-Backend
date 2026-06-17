import { Session } from "@domain/features/session/entities/Session";

/**
 * Port « out » d'accès aux sessions.
 *
 * La couche application dépend de cette interface ; l'implémentation concrète (MySQL)
 * vit dans l'infrastructure. Une table = un repository.
 */
export interface SessionRepository {
  /**
   * Persiste une session (création).
   *
   * @param session - L'entité à enregistrer.
   */
  save(session: Session): Promise<void>;

  /**
   * Met à jour une session existante (titre, date).
   *
   * @param session - L'entité à mettre à jour.
   */
  update(session: Session): Promise<void>;

  /**
   * Récupère toutes les sessions d'une campagne (des plus récentes aux plus anciennes).
   *
   * @param campaignId - Identifiant de la campagne parente.
   * @returns La liste des sessions (vide si aucune).
   */
  findByCampaignId(campaignId: string): Promise<Session[]>;

  /**
   * Récupère une session par son identifiant.
   *
   * @param id - L'identifiant de la session.
   * @returns La session, ou `null` si aucune ne correspond.
   */
  findById(id: string): Promise<Session | null>;

  /**
   * Supprime une session par son identifiant (idempotent : aucune erreur si absente).
   *
   * @param id - L'identifiant de la session à supprimer.
   */
  deleteById(id: string): Promise<void>;
}
