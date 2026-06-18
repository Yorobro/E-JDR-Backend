import { FriendGroupName } from "@domain/features/friend-group/value-objects/FriendGroupName";

export interface FriendGroupSnapshot {
  readonly id: string;
  readonly name: FriendGroupName;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export class FriendGroup {
  private constructor(private readonly props: FriendGroupSnapshot) {}

  public static create(params: {
    id: string;
    name: FriendGroupName;
    createdBy: string;
    createdAt: Date;
  }): FriendGroup {
    return new FriendGroup(params);
  }

  public static restore(snapshot: FriendGroupSnapshot): FriendGroup {
    return new FriendGroup(snapshot);
  }

  public get id(): string {
    return this.props.id;
  }

  public get name(): FriendGroupName {
    return this.props.name;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
