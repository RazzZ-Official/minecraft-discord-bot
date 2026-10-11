import type { APIEmbedField, Client, User } from 'discord.js'
import type { WhitelistConfig } from '../../config/types.js'
import type { AuditLog } from '../../services/AuditLog.js'
import { editionName } from '../../shared/format.js'
import { WhitelistText } from './messages.js'
import { PlayerName } from './PlayerName.js'
import type { WhitelistEntry } from './PlayerName.js'
import type { WhitelistRequest } from './WhitelistRequestModel.js'
import type { WhitelistViews } from './WhitelistViews.js'

const text = WhitelistText.embeds

/** Sends whitelist messages outside of interactions: the staff channel, player DMs and the audit log. */
export class WhitelistNotifier {
  constructor(
    private readonly config: WhitelistConfig,
    private readonly views: WhitelistViews,
    private readonly audit: AuditLog
  ) {}

  /** Posts a new request in the staff channel and returns the message ID. */
  async postToStaff(client: Client, request: WhitelistRequest, player: User): Promise<string> {
    const channel = await client.channels.fetch(this.config.staffChannelId)
    if (!channel?.isSendable()) throw new Error(`Staff channel ${this.config.staffChannelId} is not a text channel.`)
    const message = await channel.send(this.views.staffRequestMessage(request))
    await this.audit.record(client, {
      actor: player,
      action: '📝 Whitelist requested',
      summary: `requested to whitelist ${request.whitelistName} (${editionName(request.edition)}).`,
      fields: this.requestFields(request),
      color: 'Yellow',
    })
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
    const approved = request.status === 'approved'
    const fields: APIEmbedField[] = [
      { name: 'Player', value: `<@${request.userId}> (${request.userTag})`, inline: true },
      ...this.requestFields(request),
      { name: text.playerNotified, value: request.notified ? '✅' : '❌', inline: true },
    ]
    if (!approved) fields.push({ name: text.reason, value: request.reason ?? text.noReason })
    await this.audit.record(client, {
      actor: staff,
      action: approved ? '✅ Whitelist approved' : '❌ Whitelist rejected',
      summary: `${approved ? 'approved' : 'rejected'} ${request.whitelistName} for ${request.userTag}.`,
      fields,
      color: approved ? 'Green' : 'Red',
    })
  }

  async logRemoval(client: Client, entry: WhitelistEntry, staff: User): Promise<void> {
    await this.audit.record(client, {
      actor: staff,
      action: '🗑️ Removed from whitelist',
      summary: `removed ${entry.name} from the whitelist.`,
      fields: [
        { name: text.whitelistName, value: `\`${entry.name}\``, inline: true },
        { name: text.edition, value: editionName(PlayerName.entryEdition(entry)), inline: true },
      ],
      color: 'DarkRed',
    })
  }

  private requestFields(request: WhitelistRequest): APIEmbedField[] {
    return [
      { name: text.whitelistName, value: `\`${request.whitelistName}\``, inline: true },
      { name: text.edition, value: editionName(request.edition), inline: true },
    ]
  }
}
