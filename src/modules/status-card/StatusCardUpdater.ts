import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js'
import type { Client, Message } from 'discord.js'
import type { Logger } from '../../core/Logger.js'
import type { StatusCardService } from './StatusCardService.js'
import { StatusMessageModel } from './StatusMessageModel.js'
import type { StatusMessage } from './StatusMessageModel.js'

// Errors meaning the status message is gone for good, so it is forgotten instead of retried.
const GONE_ERROR_CODES: readonly number[] = [
  RESTJSONErrorCodes.UnknownMessage,
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.MissingAccess,
]

/** Edits every saved status message with the latest status. */
export class StatusCardUpdater {
  constructor(
    private readonly service: StatusCardService,
    private readonly logger: Logger
  ) {}

  async updateAll(client: Client<true>): Promise<void> {
    const saved = await StatusMessageModel.find().lean()
    for (const entry of saved) {
      try {
        await this.update(client, entry)
      } catch (error) {
        if (error instanceof DiscordAPIError && GONE_ERROR_CODES.includes(Number(error.code))) {
          await StatusMessageModel.deleteOne({ messageId: entry.messageId })
          this.logger.warn(`Status message ${entry.messageId} no longer exists and was removed.`)
        } else {
          this.logger.error(`Could not update status message ${entry.messageId}.`, error)
        }
      }
    }
  }

  async update(client: Client<true>, entry: StatusMessage): Promise<void> {
    const message = await this.fetchMessage(client, entry)
    const attached = [...message.attachments.values()].map((attachment) => attachment.name)
    await message.edit(await this.service.render(entry, attached))
    this.logger.debug(`Updated status message ${entry.messageId}.`)
  }

  private async fetchMessage(client: Client<true>, entry: StatusMessage): Promise<Message> {
    const channel = await client.channels.fetch(entry.channelId)
    if (!channel?.isTextBased()) throw new Error(`Channel ${entry.channelId} is not a text channel.`)
    return channel.messages.fetch(entry.messageId)
  }
}
