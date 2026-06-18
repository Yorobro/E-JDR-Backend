import { NextFunction, Request, Response } from "express";
import { InviteMemberUseCase } from "@application/features/friend-group/abstractions/usecases/InviteMemberUseCase";
import { ListMyInvitationsUseCase } from "@application/features/friend-group/abstractions/usecases/ListMyInvitationsUseCase";
import { AcceptInvitationUseCase } from "@application/features/friend-group/abstractions/usecases/AcceptInvitationUseCase";
import { DeclineInvitationUseCase } from "@application/features/friend-group/abstractions/usecases/DeclineInvitationUseCase";
import { GroupHttpMapper } from "@presentation/http/features/friend-group/mappers/GroupHttpMapper";

export class InvitationController {
  constructor(
    private readonly inviteMember: InviteMemberUseCase,
    private readonly listMyInvitations: ListMyInvitationsUseCase,
    private readonly acceptInvitation: AcceptInvitationUseCase,
    private readonly declineInvitation: DeclineInvitationUseCase,
  ) {}

  public invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { email?: unknown };
      const result = await this.inviteMember.execute({
        groupId: req.params.id ?? "",
        invitedByUserId: req.user!.userId,
        inviteeEmail: body.email as string,
      });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(201).json({ invitationId: result.value.invitationId });
    } catch (error) {
      next(error);
    }
  };

  public listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listMyInvitations.execute({ userId: req.user!.userId });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(200).json({
        invitations: result.value.map((inv) => ({
          id: inv.id,
          groupId: inv.groupId,
          groupName: inv.groupName,
          invitedBy: inv.invitedBy,
          createdAt: inv.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  public accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.acceptInvitation.execute({
        invitationId: req.params.id ?? "",
        userId: req.user!.userId,
      });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(200).send();
    } catch (error) {
      next(error);
    }
  };

  public decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.declineInvitation.execute({
        invitationId: req.params.id ?? "",
        userId: req.user!.userId,
      });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(200).send();
    } catch (error) {
      next(error);
    }
  };
}
