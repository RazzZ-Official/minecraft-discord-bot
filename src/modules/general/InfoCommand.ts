import os from 'node:os'
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommand } from '../../core/commands/SlashCommand.js'
import { fill, formatDuration } from '../../shared/format.js'
import { GeneralText } from './messages.js'

const BYTES_PER_MB = 1024 * 1024

/** Bot statistics for administrators. */
export class InfoCommand extends SlashCommand {
  readonly data = new SlashCommandBuilder()
    .setName('info')
    .setDescription(GeneralText.info.description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const reply = await interaction.deferReply({ flags: MessageFlags.Ephemeral, withResponse: true })
    const ping = (reply.resource?.message?.createdTimestamp ?? Date.now()) - interaction.createdTimestamp
    const { client } = interaction
    const embed = new EmbedBuilder()
      .setColor('Yellow')
      .setAuthor({ name: client.user.tag, iconURL: client.user.displayAvatarURL() })
      .setTitle(GeneralText.info.title)
      .setDescription(
        fill(GeneralText.info.body, {
          cpu: ((os.loadavg()[0] ?? 0) / os.cpus().length).toFixed(2),
          memory: (process.memoryUsage().heapUsed / BYTES_PER_MB).toFixed(2),
          node: process.version,
          uptime: formatDuration(process.uptime() * 1000),
          ping,
          websocket: client.ws.ping,
        })
      )
    await interaction.editReply({ embeds: [embed] })
  }
}
