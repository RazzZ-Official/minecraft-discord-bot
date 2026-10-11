import type { Message } from 'discord.js'
import type { AutoReplyTrigger } from '../../config/types.js'
import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import { ChannelFilter } from '../../shared/ChannelFilter.js'
import { fill } from '../../shared/format.js'

const AutoReplyText = {
  version: "The server's version: **`{version}`**.",
  ip: '**IP: `{ip}`\nPort: `{port}`**',
  site: "The server's website link: **<{site}>**.",
  online: 'The server is currently **`🟢ONLINE`** with **`{online}/{max}`** active players.',
  offline: 'The server is currently **`🔴OFFLINE`**.',
} as const

/** Whole-word, case-insensitive match for any of the trigger words, in any language. */
const triggerPattern = (trigger: AutoReplyTrigger): RegExp => {
  const words = trigger.triggerWords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return new RegExp(`(?<=^|\\P{L})(${words})(?=\\P{L}|$)`, 'iu')
}

/** Answers questions such as "what is the ip?" with the server's details. */
export class AutoReplyModule extends BotModule {
  readonly name = 'auto-reply'
  private readonly channelFilter: ChannelFilter
  private readonly replies: { trigger: AutoReplyTrigger; pattern: RegExp; build: () => Promise<string> | string }[]

  constructor(private readonly context: AppContext) {
    super()
    const { autoReply, server } = context.config
    this.channelFilter = new ChannelFilter(autoReply.enabledChannels, autoReply.disabledChannels)
    this.replies = [
      { trigger: autoReply.ip, build: () => fill(AutoReplyText.ip, { ip: server.ip, port: server.port }) },
      ...(server.site
        ? [{ trigger: autoReply.site, build: () => fill(AutoReplyText.site, { site: server.site }) }]
        : []),
      { trigger: autoReply.version, build: () => fill(AutoReplyText.version, { version: server.version }) },
      { trigger: autoReply.status, build: () => this.statusReply() },
    ]
      .filter(({ trigger }) => trigger.enabled && trigger.triggerWords.length)
      .map((reply) => ({ ...reply, pattern: triggerPattern(reply.trigger) }))
  }

  override get enabled(): boolean {
    return this.context.config.autoReply.enabled
  }

  override async onMessage(message: Message): Promise<void> {
    const { prefix } = this.context.config.commands
    if (message.author.bot || !message.inGuild() || !this.channelFilter.allows(message.channelId)) return
    if (prefix.enabled && message.content.startsWith(prefix.prefix)) return

    for (const reply of this.replies) {
      if (!reply.pattern.test(message.content)) continue
      const sent = await message.reply(await reply.build())
      this.scheduleCleanup(message, sent)
    }
  }

  private async statusReply(): Promise<string> {
    const status = await this.context.minecraft.getStatus()
    if (!status.online) return AutoReplyText.offline
    return fill(AutoReplyText.online, { online: status.players.online, max: status.players.max })
  }

  // Removes the trigger message and the reply after deleteAfterSeconds, when set.
  private scheduleCleanup(trigger: Message, reply: Message): void {
    const seconds = this.context.config.autoReply.deleteAfterSeconds
    if (seconds <= 0) return
    setTimeout(() => void Promise.allSettled([reply.delete(), trigger.delete()]), seconds * 1000)
  }
}
