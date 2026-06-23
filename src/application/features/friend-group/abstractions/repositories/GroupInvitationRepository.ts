import { GroupInvitation } from "@domain/features/friend-group/entities/GroupInvitation";
import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";

export interface PendingInvitationView {
  id: string;
  groupId: string;
  groupName: string;
  invitedBy: string;
  invitedByPseudo: string;
  createdAt: Date;
}

export interface GroupInvitationRepository {
  save(invitation: GroupInvitation): Promise<void>;
  findById(id: string): Promise<GroupInvitation | null>;
  findPendingByGroupAndUser(
    groupId: string,
    invitedUserId: string,
  ): Promise<GroupInvitation | null>;
  findPendingViewsByInvitedUser(invitedUserId: string): Promise<PendingInvitationView[]>;
  updateStatus(id: string, status: InvitationStatus): Promise<void>;
  /**
   * Supprime **toute** invitation (quel que soit son statut) pour ce couple groupe/invité.
   *
   * Utilisé avant de (ré)inviter : la contrainte d'unicité BDD `(group_id, invited_user_id)`
   * ne distingue pas le statut, donc une invitation déjà résolue (ACCEPTED/DECLINED) bloquerait
   * l'insertion d'une nouvelle invitation. On purge donc l'ancienne ligne d'abord.
   */
  deleteByGroupAndUser(groupId: string, invitedUserId: string): Promise<void>;
}
