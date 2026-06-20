import { describe, it, expect, beforeEach } from "vitest";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import { buildFakeTransactionalRepositories, buildTestMembership } from "./fakes";

describe("GroupAccessService.requireEditor", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let service: GroupAccessServiceImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    service = new GroupAccessServiceImpl(
      repos.groupMembers,
      repos.campaigns,
      repos.campaignCharacters,
    );
  });

  it("autorise un ADMIN", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "u", role: GroupRole.ADMIN }));
    expect((await service.requireEditor("u", "group-1")).isSuccess).toBe(true);
  });
  it("autorise un MJ", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "u", role: GroupRole.MJ }));
    expect((await service.requireEditor("u", "group-1")).isSuccess).toBe(true);
  });
  it("refuse un MEMBER avec NOT_GROUP_EDITOR", async () => {
    repos.groupMembers.seed(buildTestMembership({ userId: "u", role: GroupRole.MEMBER }));
    const r = await service.requireEditor("u", "group-1");
    expect(r.isFailure).toBe(true);
    expect(r.error.code).toBe("NOT_GROUP_EDITOR");
  });
  it("refuse un non-membre avec NOT_GROUP_MEMBER", async () => {
    const r = await service.requireEditor("absent", "group-1");
    expect(r.error.code).toBe("NOT_GROUP_MEMBER");
  });
});
