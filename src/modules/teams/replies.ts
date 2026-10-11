import { MessageFlags } from 'discord.js'
import type { RepliableInteraction } from 'discord.js'
import { fill } from '../../shared/format.js'
import { TeamText } from './messages.js'
import type { TeamProblem } from './TeamService.js'

export const problemText = (problem: TeamProblem): string => fill(TeamText.replies[problem.key], problem.values ?? {})

/** Private reply, or a follow-up when the interaction was already answered. */
export const replyPrivately = async (interaction: RepliableInteraction, content: string): Promise<void> => {
  if (interaction.deferred || interaction.replied) await interaction.editReply({ content, embeds: [], components: [] })
  else await interaction.reply({ content, flags: MessageFlags.Ephemeral })
}
