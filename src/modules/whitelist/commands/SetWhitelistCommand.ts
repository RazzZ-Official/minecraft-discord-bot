import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommand } from '../../../core/commands/SlashCommand.js'
import type { AuditLog } from '../../../services/AuditLog.js'
import { fill } from '../../../shared/format.js'
import { WhitelistText } from '../messages.js'
import type { StaffGuard } from '../StaffGuard.js'
import type { WhitelistViews } from '../WhitelistViews.js'

/** Posts the info card with the "Request Whitelist" button in the current channel. */
export class SetWhitelistCommand extends SlashCommand {
  readonly data = new SlashCommandBuilder()
    .setName('setwhitelist')
    .setDescription(WhitelistText.commands.setup)
    .setContexts(InteractionContextType.Guild)

  constructor(
    private readonly views: WhitelistViews,
    private readonly guard: StaffGuard,
    private readonly audit: AuditLog
  ) {
    super()
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.guard.isStaff(interaction)) {
      await interaction.reply({ content: WhitelistText.replies.notStaff, flags: MessageFlags.Ephemeral })
      return
    }
    if (!interaction.channel?.isSendable()) return
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    await interaction.channel.send(this.views.requestPanelMessage())
    await interaction.editReply(fill(WhitelistText.replies.panelPosted, { channel: `<#${interaction.channelId}>` }))
    await this.audit.record(interaction.client, {
      actor: interaction.user,
      action: '📝 Whitelist panel posted',
      summary: `posted the whitelist panel in #${interaction.channelId}.`,
      fields: [{ name: 'Channel', value: `<#${interaction.channelId}>`, inline: true }],
    })
  }
}
