import { FriendGroup } from "@domain/features/friend-group/entities/FriendGroup";

export interface FriendGroupRepository {
  save(group: FriendGroup): Promise<void>;
  findById(id: string): Promise<FriendGroup | null>;
  findByMemberId(userId: string): Promise<FriendGroup[]>;
  deleteById(id: string): Promise<void>;
}
