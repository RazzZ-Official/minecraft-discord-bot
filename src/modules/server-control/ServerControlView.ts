import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import type { BaseMessageOptions } from 'discord.js'
import type { ServerConfig } from '../../config/types.js'
import { CustomId } from '../../core/CustomId.js'
import type { ServerStatus } from '../../services/MinecraftStatusService.js'
import type { PowerAction, ServerResources } from '../../services/PanelClient.js'
import { fill, formatDuration } from '../../shared/format.js'
import { POWER_ACTIONS, PowerLabels, ServerControlIds, ServerControlText } from './messages.js'

const BYTES_PER_GB = 1024 ** 3
const STATE_EMOJIS: Record<string, string> = { running: '🟢', starting: '🟡', stopping: '🟠', offline: '🔴' }
const BUTTON_STYLES: Record<PowerAction, ButtonStyle> = {
  start: ButtonStyle.Success,
  restart: ButtonStyle.Primary,
  stop: ButtonStyle.Danger,
}

export class ServerControlView {
  constructor(private readonly server: ServerConfig) {}

  /** The control panel with power and status buttons. */
  panelMessage(): BaseMessageOptions {
    const embed = new EmbedBuilder()
      .setColor('DarkButNotBlack')
      .setAuthor({ name: this.server.name, iconURL: this.server.icon })
      .setTitle(fill(ServerControlText.panel.title, { name: this.server.name }))
      .setDescription(ServerControlText.panel.description)
      .setThumbnail(this.server.icon)
      .setFooter({ text: ServerControlText.panel.footer })
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...POWER_ACTIONS.map((action) =>
        new ButtonBuilder()
          .setCustomId(CustomId.build(ServerControlIds.power, action))
          .setLabel(PowerLabels[action].label)
          .setEmoji(PowerLabels[action].emoji)
          .setStyle(BUTTON_STYLES[action])
      ),
      new ButtonBuilder()
        .setCustomId(ServerControlIds.status)
        .setLabel('Status')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Secondary)
    )
    return { embeds: [embed], components: [buttons] }
  }

  /** Asks the admin to confirm a power action. */
  confirmPrompt(action: PowerAction): BaseMessageOptions {
    const { verb, emoji } = PowerLabels[action]
    const content =
      action === 'start' ? ServerControlText.confirmStart : fill(ServerControlText.confirm, { action: verb })
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CustomId.build(ServerControlIds.confirm, action))
        .setLabel(`Yes, ${verb.toLowerCase()}`)
        .setEmoji(emoji)
        .setStyle(BUTTON_STYLES[action]),
      new ButtonBuilder().setCustomId(ServerControlIds.cancel).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    )
    return { content, components: [buttons] }
  }

  statusEmbed(resources: ServerResources, status: ServerStatus | null): EmbedBuilder {
    const text = ServerControlText.status
    const running = resources.state === 'running'
    return new EmbedBuilder()
      .setColor(running ? 'Green' : 'Red')
      .setAuthor({ name: this.server.name, iconURL: this.server.icon })
      .setTitle(text.title)
      .addFields(
        { name: text.state, value: `${STATE_EMOJIS[resources.state] ?? '⚪'} ${resources.state}`, inline: true },
        { name: text.uptime, value: running ? formatDuration(resources.uptimeMs) : '-', inline: true },
        {
          name: text.players,
          value: status?.online ? `${status.players.online}/${status.players.max}` : '-',
          inline: true,
        },
        { name: text.cpu, value: `${resources.cpuPercent.toFixed(1)}%`, inline: true },
        { name: text.memory, value: `${(resources.memoryBytes / BYTES_PER_GB).toFixed(2)} GB`, inline: true },
        { name: text.disk, value: `${(resources.diskBytes / BYTES_PER_GB).toFixed(2)} GB`, inline: true }
      )
      .setTimestamp()
  }
}
