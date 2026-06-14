import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { GetSheetCampaignsQuery } from "@application/features/character-sheet/query/GetSheetCampaignsQuery";
import { SheetCampaignView } from "@application/features/character-sheet/abstractions/repositories/SheetCampaignView";

/** Port « in » du use case listant les campagnes auxquelles une fiche est rattachée. */
export interface GetSheetCampaignsUseCase {
  execute(query: GetSheetCampaignsQuery): Promise<Result<SheetCampaignView[], AppError>>;
}
