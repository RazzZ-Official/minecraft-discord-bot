import type { Message } from 'discord.js'
import type { CommandsConfig } from '../config/types.js'
import type { ChannelFilter } from '../shared/ChannelFilter.js'
import type { CommandRegistry } from './commands/CommandRegistry.js'
import type { Logger } from './Logger.js'
import { CoreText } from './messages.js'

const DISABLED_NOTICE_LIFETIME_MS = 5_000

/** Runs prefix commands such as "!ip" or "!help status". */
export class PrefixCommandRouter {
  constructor(
    private readonly config: CommandsConfig,
    private readonly commands: CommandRegistry,
    private readonly channelFilter: ChannelFilter,
    private readonly logger: Logger
  ) {}

  async handle(message: Message): Promise<void> {
    const { prefix } = this.config
    if (!prefix.enabled || !prefix.prefix || message.author.bot || !message.inGuild()) return
    if (!message.content.startsWith(prefix.prefix)) return

    const [word = '', ...args] = message.content.slice(prefix.prefix.length).trim().split(/\s+/)
    const command = this.commands.findPrefixCommand(word)
    if (!command?.executePrefix) return

    if (!this.channelFilter.allows(message.channelId)) {
      await this.sendDisabledNotice(message)
      return
    }
    try {
      await command.executePrefix(message, args)
    } catch (error) {
      this.logger.error(`${prefix.prefix}${command.name} failed.`, error)
      await message.reply(CoreText.error).catch(() => undefined)
    }
  }

  // Tells the member the command is disabled here, then removes both messages to keep the channel clean.
  private async sendDisabledNotice(message: Message): Promise<void> {
    const notice = await message.reply(CoreText.disabledChannel)
    setTimeout(() => {
      void Promise.allSettled([notice.delete(), message.delete()])
    }, DISABLED_NOTICE_LIFETIME_MS)
  }
}
