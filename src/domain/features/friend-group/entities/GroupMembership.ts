import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";

export interface GroupMembershipSnapshot {
  readonly groupId: string;
  readonly userId: string;
  readonly role: GroupRole;
  readonly createdAt: Date;
}

export class GroupMembership {
  private constructor(private readonly props: GroupMembershipSnapshot) {}

  public static create(params: {
    groupId: string;
    userId: string;
    role: GroupRole;
    createdAt: Date;
  }): GroupMembership {
    return new GroupMembership(params);
  }

  public static restore(snapshot: GroupMembershipSnapshot): GroupMembership {
    return new GroupMembership(snapshot);
  }

  public get groupId(): string {
    return this.props.groupId;
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get role(): GroupRole {
    return this.props.role;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public isAdmin(): boolean {
    return this.props.role.isAdmin();
  }

  public isEditor(): boolean {
    return this.props.role.isEditor();
  }
}
