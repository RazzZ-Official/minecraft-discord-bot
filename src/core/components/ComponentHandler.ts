import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js'

/** Handles clicks on buttons whose custom ID starts with `customId` (see CustomId). */
export abstract class ButtonHandler {
  abstract readonly customId: string
  abstract handle(interaction: ButtonInteraction, argument: string | undefined): Promise<void>
}

/** Handles submitted modals whose custom ID starts with `customId` (see CustomId). */
export abstract class ModalHandler {
  abstract readonly customId: string
  abstract handle(interaction: ModalSubmitInteraction, argument: string | undefined): Promise<void>
}
