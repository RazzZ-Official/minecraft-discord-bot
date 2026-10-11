import type { MessageMentionOptions } from 'discord.js'
import type { MentionSetting } from '../config/types.js'

/** A mention setting ("everyone", "here", a role ID or "") turned into message text and allowed mentions. */
export class Mention {
  private constructor(
    readonly text: string,
    readonly allowedMentions: MessageMentionOptions
  ) {}

  static none(): Mention {
    return new Mention('', { parse: [] })
  }

  static from(setting: MentionSetting): Mention {
    if (setting === 'everyone' || setting === 'here') return new Mention(`@${setting}`, { parse: ['everyone'] })
    if (setting) return new Mention(`<@&${setting}>`, { roles: [setting] })
    return Mention.none()
  }

  /** Only builds the mention when the member who triggered it may mention everyone themselves. */
  static forMember(setting: MentionSetting, canMentionEveryone: boolean): Mention {
    return canMentionEveryone ? Mention.from(setting) : Mention.none()
  }
}
