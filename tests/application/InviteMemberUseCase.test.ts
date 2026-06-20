import { describe, it, expect, beforeEach } from "vitest";
import { GroupRole } from "@domain/features/friend-group/value-objects/GroupRole";
import { InviteMemberUseCaseImpl } from "@application/features/friend-group/usecases/InviteMemberUseCaseImpl";
import { GroupAccessServiceImpl } from "@application/features/friend-group/services/GroupAccessServiceImpl";
import {
  buildFakeTransactionalRepositories,
  FakeUnitOfWork,
  FakeLogger,
  FakeIdGenerator,
  buildTestMembership,
} from "./fakes";

/**
 * Couvre la distinction de codes d'erreur à l'invitation : un e-mail SYNTAXIQUEMENT invalide est
 * une entrée invalide (INVALID_EMAIL → 400), alors qu'un e-mail bien formé mais sans compte reste
 * volontairement indifférencié (INVITED_USER_NOT_FOUND → 404) pour ne pas révéler l'existence
 * d'un compte (anti-énumération).
 */
describe("InviteMemberUseCase", () => {
  let repos: ReturnType<typeof buildFakeTransactionalRepositories>;
  let useCase: InviteMemberUseCaseImpl;

  beforeEach(() => {
    repos = buildFakeTransactionalRepositories();
    // L'acteur (user-1) doit être membre du groupe pour pouvoir inviter (requireMember).
    repos.groupMembers.seed(buildTestMembership({ userId: "user-1", role: GroupRole.ADMIN }));
    const accessService = new GroupAccessServiceImpl(
      repos.groupMembers,
      repos.campaigns,
      repos.campaignCharacters,
    );
    useCase = new InviteMemberUseCaseImpl({
      credentialRepository: repos.credentials,
      groupMemberRepository: repos.groupMembers,
      groupInvitationRepository: repos.groupInvitations,
      groupAccessService: accessService,
      idGenerator: new FakeIdGenerator(),
      unitOfWork: new FakeUnitOfWork(repos),
      logger: new FakeLogger(),
    });
  });

  it("rejette un e-mail malformé en INVALID_EMAIL (400)", async () => {
    const result = await useCase.execute({
      groupId: "group-1",
      invitedByUserId: "user-1",
      inviteeEmail: "pas-un-email",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("INVALID_EMAIL");
  });

  it("renvoie INVITED_USER_NOT_FOUND (404) pour un e-mail valide sans compte", async () => {
    const result = await useCase.execute({
      groupId: "group-1",
      invitedByUserId: "user-1",
      inviteeEmail: "inexistant@test.com",
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe("INVITED_USER_NOT_FOUND");
  });
});
