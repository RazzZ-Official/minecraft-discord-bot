import { MessageFlags } from 'discord.js'
import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js'
import type { Edition } from '../../../config/types.js'
import { ButtonHandler, ModalHandler } from '../../../core/components/ComponentHandler.js'
import { editionName, fill, stripBackticks } from '../../../shared/format.js'
import { WhitelistIds, WhitelistText } from '../messages.js'
import type { SubmitResult, WhitelistService } from '../WhitelistService.js'
import type { WhitelistViews } from '../WhitelistViews.js'

const replies = WhitelistText.replies

/** The "Request Whitelist" button on the /setwhitelist panel: opens the request form. */
export class OpenRequestFormButton extends ButtonHandler {
  readonly customId = WhitelistIds.openForm

  constructor(private readonly views: WhitelistViews) {
    super()
  }

  async handle(interaction: ButtonInteraction): Promise<void> {
    await interaction.showModal(this.views.requestFormModal())
  }
}

/** The submitted request form: validates it and sends the request to staff. */
export class RequestFormModal extends ModalHandler {
  readonly customId = WhitelistIds.submitForm

  constructor(private readonly service: WhitelistService) {
    super()
  }

  async handle(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const username = interaction.fields.getTextInputValue('username')
    const [selected] = interaction.fields.getStringSelectValues('edition')
    const edition: Edition = selected === 'bedrock' ? 'bedrock' : 'java'
    const result = await this.service.submit(interaction.client, interaction.user, edition, username)
    await interaction.editReply(this.replyFor(result, edition, username))
  }

  private replyFor(result: SubmitResult, edition: Edition, input: string): string {
    switch (result.kind) {
      case 'invalid':
        return fill(edition === 'bedrock' ? replies.invalidBedrock : replies.invalidJava, {
          username: stripBackticks(input),
        })
      case 'already-whitelisted':
        return fill(replies.alreadyWhitelisted, { username: result.whitelistName })
      case 'already-pending':
        return fill(replies.alreadyPending, { username: result.whitelistName })
      case 'name-pending':
        return fill(replies.namePending, { username: result.whitelistName })
      case 'submitted':
        return fill(replies.submitted, {
          username: result.request.whitelistName,
          edition: editionName(result.request.edition),
        })
    }
  }
}
