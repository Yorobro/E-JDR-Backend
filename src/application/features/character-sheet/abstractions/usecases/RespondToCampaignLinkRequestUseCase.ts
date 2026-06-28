import { Result } from "@application/shared/Result";
import { AppError } from "@application/errors/AppError";
import { RespondToCampaignLinkRequestCommand } from "@application/features/character-sheet/commands/RespondToCampaignLinkRequestCommand";

/**
 * Port « in » du use case « le MJ valide ou refuse une demande de rattachement ».
 *
 * Acceptation → la fiche passe ACCEPTED. Refus → la fiche est **supprimée**.
 */
export interface RespondToCampaignLinkRequestUseCase {
  execute(command: RespondToCampaignLinkRequestCommand): Promise<Result<void, AppError>>;
}
