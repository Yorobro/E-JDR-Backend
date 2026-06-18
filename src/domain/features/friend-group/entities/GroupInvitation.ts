import { InvitationStatus } from "@domain/features/friend-group/value-objects/InvitationStatus";

export interface GroupInvitationSnapshot {
  readonly id: string;
  readonly groupId: string;
  readonly invitedUserId: string;
  readonly invitedBy: string;
  readonly status: InvitationStatus;
  readonly createdAt: Date;
}

export class GroupInvitation {
  private constructor(private readonly props: GroupInvitationSnapshot) {}

  public static create(params: {
    id: string;
    groupId: string;
    invitedUserId: string;
    invitedBy: string;
    status: InvitationStatus;
    createdAt: Date;
  }): GroupInvitation {
    return new GroupInvitation(params);
  }

  public static restore(snapshot: GroupInvitationSnapshot): GroupInvitation {
    return new GroupInvitation(snapshot);
  }

  public get id(): string {
    return this.props.id;
  }

  public get groupId(): string {
    return this.props.groupId;
  }

  public get invitedUserId(): string {
    return this.props.invitedUserId;
  }

  public get invitedBy(): string {
    return this.props.invitedBy;
  }

  public get status(): InvitationStatus {
    return this.props.status;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public isInvitedUser(userId: string): boolean {
    return this.props.invitedUserId === userId;
  }

  public isPending(): boolean {
    return this.props.status.isPending();
  }
}
