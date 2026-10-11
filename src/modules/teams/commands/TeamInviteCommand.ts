import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommand } from '../../../core/commands/SlashCommand.js'
import { fill } from '../../../shared/format.js'
import { TeamText } from '../messages.js'
import { problemText } from '../replies.js'
import type { TeamService } from '../TeamService.js'
import type { TeamViews } from '../TeamViews.js'

/** /teaminvite @user: the leader invites a player, who gets a DM with Accept and Decline buttons. */
export class TeamInviteCommand extends SlashCommand {
  readonly data = new SlashCommandBuilder()
    .setName('teaminvite')
    .setDescription(TeamText.commands.invite)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) => option.setName('player').setDescription('The player to invite.').setRequired(true))

  constructor(
    private readonly service: TeamService,
    private readonly views: TeamViews,
    private readonly inviteExpiryHours: number
  ) {
    super()
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const target = interaction.options.getUser('player', true)
    const result = await this.service.invite(interaction.user, target)
    if (!result.ok) {
      await interaction.editReply(problemText(result.problem))
      return
    }

    const { team, invite } = result.value
    const delivered = await target
      .send(this.views.inviteDm(team, invite, interaction.user))
      .then(() => true)
      .catch(() => false)
    if (!delivered) {
      await this.service.cancelInvite(invite.inviteId)
      await interaction.editReply(fill(TeamText.replies.inviteDmFailed, { user: `<@${target.id}>` }))
      return
    }
    await interaction.editReply(
      fill(TeamText.replies.inviteSent, { user: `<@${target.id}>`, hours: this.inviteExpiryHours })
    )
  }
}
