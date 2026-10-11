import chalk from 'chalk'
import type { BaseMessageOptions, Client, User } from 'discord.js'
import type { WhitelistConfig } from '../../config/types.js'
import type { Logger } from '../../core/Logger.js'
import { editionName, fill } from '../../shared/format.js'
import { WhitelistText } from './messages.js'
import { PlayerName } from './PlayerName.js'
import type { WhitelistEntry } from './PlayerName.js'
import type { WhitelistRequest } from './WhitelistRequestModel.js'
import type { WhitelistViews } from './WhitelistViews.js'

/** Sends whitelist messages outside of interactions: the staff channel, player DMs, the log channel and the console. */
export class WhitelistNotifier {
  constructor(
    private readonly config: WhitelistConfig,
    private readonly views: WhitelistViews,
    private readonly logger: Logger
  ) {}

  /** Posts a new request in the staff channel and returns the message ID. */
  async postToStaff(client: Client, request: WhitelistRequest): Promise<string> {
    const channel = await client.channels.fetch(this.config.staffChannelId)
    if (!channel?.isSendable()) throw new Error(`Staff channel ${this.config.staffChannelId} is not a text channel.`)
    const message = await channel.send(this.views.staffRequestMessage(request))
    this.logger.info(fill(WhitelistText.console.requested, this.consoleValues(request)))
    return message.id
  }

  /** Sends the decision to the player. Returns false when their DMs are closed. */
  async notifyPlayer(client: Client, request: WhitelistRequest): Promise<boolean> {
    try {
      const user = await client.users.fetch(request.userId)
      await user.send(this.views.decisionDm(request))
      return true
    } catch {
      return false
    }
  }

  async logDecision(client: Client, request: WhitelistRequest, staff: User): Promise<void> {
    const template = request.status === 'approved' ? WhitelistText.console.approved : WhitelistText.console.rejected
    this.logger.info(fill(template, { ...this.consoleValues(request), staff: chalk.cyan(staff.tag) }))
    await this.sendToLogChannel(client, this.views.decisionLog(request))
  }

  async logRemoval(client: Client, entry: WhitelistEntry, staff: User): Promise<void> {
    this.logger.info(
      fill(WhitelistText.console.removed, {
        staff: chalk.cyan(staff.tag),
        username: chalk.cyan(entry.name),
        edition: editionName(PlayerName.entryEdition(entry)),
      })
    )
    await this.sendToLogChannel(client, this.views.removalLog(entry, staff.id))
  }

  private consoleValues(request: WhitelistRequest): Record<string, string> {
    return {
      user: chalk.cyan(request.userTag),
      username: chalk.cyan(request.whitelistName),
      edition: editionName(request.edition),
    }
  }

  private async sendToLogChannel(client: Client, message: BaseMessageOptions): Promise<void> {
    if (!this.config.logChannelId) return
    try {
      const channel = await client.channels.fetch(this.config.logChannelId)
      if (channel?.isSendable()) await channel.send(message)
    } catch (error) {
      this.logger.error('Could not send to the whitelist log channel.', error)
    }
  }
}
