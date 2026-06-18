import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface InviteMemberCommand {
  groupId: string;
  invitedByUserId: string;
  inviteeEmail: string;
}

export interface InviteMemberResult {
  invitationId: string;
}

export interface InviteMemberUseCase {
  execute(command: InviteMemberCommand): Promise<Result<InviteMemberResult, AppError>>;
}
