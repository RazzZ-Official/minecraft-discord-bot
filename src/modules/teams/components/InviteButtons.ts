import type { ButtonInteraction } from 'discord.js'
import { ButtonHandler } from '../../../core/components/ComponentHandler.js'
import { fill } from '../../../shared/format.js'
import { TeamIds, TeamText } from '../messages.js'
import { problemText, replyPrivately } from '../replies.js'
import type { TeamService } from '../TeamService.js'
import type { TeamViews } from '../TeamViews.js'

/** "Accept" on an invite DM. */
export class AcceptInviteButton extends ButtonHandler {
  readonly customId = TeamIds.accept

  constructor(
    private readonly service: TeamService,
    private readonly views: TeamViews
  ) {
    super()
  }

  async handle(interaction: ButtonInteraction, inviteId: string | undefined): Promise<void> {
    if (!inviteId) return
    await interaction.deferUpdate()
    const result = await this.service.acceptInvite(interaction.client, interaction.user, inviteId)
    if (!result.ok) {
      // Keep the buttons when the player could still accept later, eg. while teams are locked.
      if (result.problem.key === 'locked') await interaction.followUp(problemText(result.problem))
      else await interaction.editReply(this.views.inviteAnswered(problemText(result.problem)))
      return
    }
    const team = result.value
    await interaction.editReply(
      this.views.inviteAnswered(
        fill(TeamText.replies.inviteAccepted, { tag: team.tag, name: team.name, channel: `<#${team.chatChannelId}>` })
      )
    )
  }
}

/** "Decline" on an invite DM. */
export class DeclineInviteButton extends ButtonHandler {
  readonly customId = TeamIds.decline

  constructor(
    private readonly service: TeamService,
    private readonly views: TeamViews
  ) {
    super()
  }

  async handle(interaction: ButtonInteraction, inviteId: string | undefined): Promise<void> {
    if (!inviteId) return
    const result = await this.service.declineInvite(interaction.client, interaction.user, inviteId)
    if (!result.ok) {
      await replyPrivately(interaction, problemText(result.problem))
      return
    }
    const team = result.value
    const content = team
      ? fill(TeamText.replies.inviteDeclined, { tag: team.tag, name: team.name })
      : TeamText.replies.inviteNotFound
    await interaction.update(this.views.inviteAnswered(content))
  }
}
