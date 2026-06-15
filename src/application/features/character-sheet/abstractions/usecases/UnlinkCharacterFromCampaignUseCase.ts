import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { UnlinkCharacterFromCampaignCommand } from "@application/features/character-sheet/commands/UnlinkCharacterFromCampaignCommand";

/** Port « in » du use case de détachement d'une fiche d'une campagne. */
export interface UnlinkCharacterFromCampaignUseCase {
  execute(command: UnlinkCharacterFromCampaignCommand): Promise<Result<void, AppError>>;
}
