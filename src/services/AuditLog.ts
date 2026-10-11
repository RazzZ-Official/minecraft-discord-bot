import chalk from 'chalk'
import { EmbedBuilder } from 'discord.js'
import type { APIEmbedField, Client, ColorResolvable, User } from 'discord.js'
import type { AuditLogConfig } from '../config/types.js'
import type { Logger } from '../core/Logger.js'

export interface AuditEntry {
  /** Who did it. */
  actor: User
  /** Short title, eg. "🔁 Server restarted". */
  action: string
  /** One line for the console, eg. "restarted the server". */
  summary: string
  fields?: APIEmbedField[]
  color?: ColorResolvable
}

/** Records every action taken through the bot in the dc-mc-logs channel and the console. */
export class AuditLog {
  constructor(
    private readonly config: AuditLogConfig,
    private readonly logger: Logger
  ) {}

  async record(client: Client, entry: AuditEntry): Promise<void> {
    this.logger.info(`${chalk.cyan(entry.actor.tag)} ${entry.summary}`)
    if (!this.config.channelId) return
    const embed = new EmbedBuilder()
      .setColor(entry.color ?? 'Blurple')
      .setAuthor({ name: entry.actor.tag, iconURL: entry.actor.displayAvatarURL() })
      .setTitle(entry.action)
      .addFields({ name: 'By', value: `<@${entry.actor.id}>`, inline: true }, ...(entry.fields ?? []))
      .setTimestamp()
    try {
      const channel = await client.channels.fetch(this.config.channelId)
      if (channel?.isSendable()) await channel.send({ embeds: [embed], allowedMentions: { parse: [] } })
    } catch (error) {
      this.logger.error('Could not write to the audit log channel.', error)
    }
  }
}
