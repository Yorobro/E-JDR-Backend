import { CampaignName } from "@domain/features/campaign/value-objects/CampaignName";

/**
 * Données nécessaires pour reconstruire une `Campaign` existante (ex : depuis la base).
 * Le nom est déjà un value object validé via {@link CampaignName}.
 */
export interface CampaignSnapshot {
  /** Identifiant unique de la campagne. */
  readonly id: string;
  /** Identifiant de l'utilisateur **maître du jeu** propriétaire de la campagne. */
  readonly gameMasterId: string;
  /** Nom de la campagne (value object garantissant la validité). */
  readonly name: CampaignName;
  /** Date de création de la campagne. */
  readonly createdAt: Date;
}

/**
 * Entité métier représentant une **campagne de jeu de rôle**, créée et possédée par un
 * utilisateur agissant comme **maître du jeu** (MJ). Un même utilisateur peut posséder
 * plusieurs campagnes.
 *
 * L'entité est immuable de l'extérieur : aucun setter, accès en lecture seule. Le nom est
 * porté par un value object {@link CampaignName} qui garantit sa validité à la construction.
 * La propriété de la campagne (qui en est le MJ) est exprimée par {@link Campaign.isGameMaster}.
 */
export class Campaign {
  /**
   * Constructeur privé : la création passe par les factories {@link Campaign.create}
   * (nouvelle campagne) ou {@link Campaign.restore} (campagne existante).
   *
   * @param props - L'instantané complet et déjà validé de la campagne.
   */
  private constructor(private readonly props: CampaignSnapshot) {}

  /**
   * Crée une **nouvelle** campagne. L'utilisateur fourni en `gameMasterId` en devient
   * le maître du jeu (propriétaire).
   *
   * @param params - Les données de la nouvelle campagne.
   * @param params.id - Identifiant unique (généré en amont par un `IdGeneratorService`).
   * @param params.gameMasterId - Identifiant du MJ propriétaire (l'utilisateur authentifié).
   * @param params.name - Nom de la campagne (value object déjà validé).
   * @param params.createdAt - Horodatage de création (injecté pour rester testable/déterministe).
   * @returns Une nouvelle instance de `Campaign`.
   */
  public static create(params: {
    id: string;
    gameMasterId: string;
    name: CampaignName;
    createdAt: Date;
  }): Campaign {
    return new Campaign(params);
  }

  /**
   * Reconstruit une campagne **existante** à partir d'un instantané (ex : ligne de BDD mappée).
   *
   * @param snapshot - L'état complet et déjà validé de la campagne.
   * @returns L'instance de `Campaign` reconstruite.
   */
  public static restore(snapshot: CampaignSnapshot): Campaign {
    return new Campaign(snapshot);
  }

  /** @returns L'identifiant unique de la campagne. */
  public get id(): string {
    return this.props.id;
  }

  /** @returns L'identifiant du maître du jeu propriétaire. */
  public get gameMasterId(): string {
    return this.props.gameMasterId;
  }

  /** @returns Le nom de la campagne (value object). */
  public get name(): CampaignName {
    return this.props.name;
  }

  /** @returns La date de création de la campagne. */
  public get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Indique si l'utilisateur donné est le **maître du jeu** de cette campagne.
   *
   * Exprime l'invariant de propriété au sein du domaine : toute future opération réservée
   * au MJ (renommer, supprimer, inviter…) s'appuiera sur cette règle plutôt que de comparer
   * des identifiants ailleurs dans le code.
   *
   * @param userId - L'identifiant de l'utilisateur à tester.
   * @returns `true` si l'utilisateur est le MJ propriétaire, `false` sinon.
   */
  public isGameMaster(userId: string): boolean {
    return this.props.gameMasterId === userId;
  }
}
