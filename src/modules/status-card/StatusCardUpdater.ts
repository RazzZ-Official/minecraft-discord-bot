import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js'
import type { Client, Message } from 'discord.js'
import type { Logger } from '../../core/Logger.js'
import type { StatusCardService } from './StatusCardService.js'
import type { StatusMessage, StatusMessageRepository } from './StatusMessageRepository.js'

// Errors meaning the status message is gone for good, so it is forgotten instead of retried. Missing access is not
// one of them: it can be a temporary permission problem, so the message is kept and retried.
const GONE_ERROR_CODES: readonly number[] = [RESTJSONErrorCodes.UnknownMessage, RESTJSONErrorCodes.UnknownChannel]

/** Edits every saved status message with the latest status. */
export class StatusCardUpdater {
  constructor(
    private readonly messages: StatusMessageRepository,
    private readonly service: StatusCardService,
    private readonly logger: Logger
  ) {}

  async updateAll(client: Client<true>): Promise<void> {
    for (const entry of [...this.messages.all()]) {
      try {
        await this.update(client, entry)
      } catch (error) {
        if (error instanceof DiscordAPIError && GONE_ERROR_CODES.includes(Number(error.code))) {
          await this.messages.remove(entry.messageId)
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
