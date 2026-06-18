import { NextFunction, Request, Response } from "express";
import { CreateGroupUseCase } from "@application/features/friend-group/abstractions/usecases/CreateGroupUseCase";
import { GetGroupUseCase } from "@application/features/friend-group/abstractions/usecases/GetGroupUseCase";
import { ListMyGroupsUseCase } from "@application/features/friend-group/abstractions/usecases/ListMyGroupsUseCase";
import { DeleteGroupUseCase } from "@application/features/friend-group/abstractions/usecases/DeleteGroupUseCase";
import { RemoveMemberUseCase } from "@application/features/friend-group/abstractions/usecases/RemoveMemberUseCase";
import { ChangeMemberRoleUseCase } from "@application/features/friend-group/abstractions/usecases/ChangeMemberRoleUseCase";
import { GroupHttpMapper } from "@presentation/http/features/friend-group/mappers/GroupHttpMapper";

export class GroupController {
  constructor(
    private readonly createGroup: CreateGroupUseCase,
    private readonly getGroup: GetGroupUseCase,
    private readonly listMyGroups: ListMyGroupsUseCase,
    private readonly deleteGroup: DeleteGroupUseCase,
    private readonly removeMember: RemoveMemberUseCase,
    private readonly changeMemberRole: ChangeMemberRoleUseCase,
  ) {}

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { name?: unknown };
      const result = await this.createGroup.execute({
        createdBy: req.user!.userId,
        name: body.name as string,
      });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      const { id, name, createdAt } = result.value;
      res.status(201).json({ id, name, createdAt: createdAt.toISOString() });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listMyGroups.execute({ userId: req.user!.userId });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(200).json({
        groups: result.value.map((g) => ({
          id: g.id,
          name: g.name,
          myRole: g.myRole,
          createdAt: g.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  public get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getGroup.execute({
        groupId: req.params.id ?? "",
        userId: req.user!.userId,
      });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      const g = result.value;
      res.status(200).json({
        id: g.id,
        name: g.name,
        myRole: g.myRole,
        createdAt: g.createdAt.toISOString(),
        members: g.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deleteGroup.execute({
        groupId: req.params.id ?? "",
        userId: req.user!.userId,
      });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  public removeMemberHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.removeMember.execute({
        groupId: req.params.id ?? "",
        actorId: req.user!.userId,
        targetUserId: req.params.userId ?? "",
      });
      if (result.isFailure) {
        res
          .status(GroupHttpMapper.statusFor(result.error))
          .json({ code: result.error.code, message: result.error.message });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  public changeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { role?: unknown };
      const result = await this.changeMemberRole.execute({
        groupId: req.params.id ?? "",
        actorId: req.user!.userId,
        targetUserId: req.params.userId ?? "",
        newRole: body.role as string,
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
