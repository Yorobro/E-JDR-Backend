import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { LinkCharacterToCampaignCommand } from "@application/features/character-sheet/commands/LinkCharacterToCampaignCommand";

/** Port « in » du use case de rattachement d'une fiche à une campagne. */
export interface LinkCharacterToCampaignUseCase {
  execute(command: LinkCharacterToCampaignCommand): Promise<Result<void, AppError>>;
}
