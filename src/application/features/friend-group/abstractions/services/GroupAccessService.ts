import { AppError } from "@application/errors/AppError";
import { Result } from "@application/shared/Result";

export interface GroupAccessService {
  requireMember(userId: string, groupId: string): Promise<Result<void, AppError>>;
  requireAdmin(userId: string, groupId: string): Promise<Result<void, AppError>>;
  requireEditor(userId: string, groupId: string): Promise<Result<void, AppError>>;

  /**
   * Indique si l'utilisateur est le **maître du jeu** d'au moins une campagne à laquelle la fiche
   * donnée est rattachée (D10 : un MJ peut modifier les fiches intégrées à sa campagne).
   *
   * @param userId - L'utilisateur à tester.
   * @param sheetId - La fiche dont on inspecte les campagnes liées.
   * @returns `true` si l'utilisateur est MJ d'une de ces campagnes, `false` sinon.
   */
  isGameMasterOfSheetCampaign(userId: string, sheetId: string): Promise<boolean>;
}
