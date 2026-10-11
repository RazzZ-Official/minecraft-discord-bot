import type { Guild } from 'discord.js'
import type { Logger } from '../core/Logger.js'
import type { AccountLinks } from './AccountLinks.js'

// Discord nicknames are limited to 32 characters.
const NICKNAME_MAX_LENGTH = 32

export type NicknameResult = 'updated' | 'unchanged' | 'not-linked' | 'failed'

/**
 * Keeps Discord nicknames matching Minecraft names: "Steve", or "[RZ] Steve" for members of a team, so everyone is
 * easy to identify.
 */
export class Nicknames {
  constructor(
    private readonly enabled: boolean,
    private readonly links: AccountLinks,
    /** The team tag of a Discord user, or null when they are not in a team. */
    private readonly teamTagOf: (userId: string) => string | null,
    private readonly logger: Logger
  ) {}

  static format(minecraftName: string, teamTag: string | null): string {
    return (teamTag ? `[${teamTag}] ${minecraftName}` : minecraftName).slice(0, NICKNAME_MAX_LENGTH)
  }

  /** Sets the member's nickname from their linked name and team. Discord does not allow changing the owner's. */
  async update(guild: Guild, userId: string): Promise<NicknameResult> {
    if (!this.enabled) return 'unchanged'
    const link = this.links.get(userId)
    if (!link) return 'not-linked'
    try {
      const member = await guild.members.fetch(userId)
      const nickname = Nicknames.format(link.minecraftName, this.teamTagOf(userId))
      if (member.nickname === nickname) return 'unchanged'
      await member.setNickname(nickname, 'Matches the linked Minecraft name')
      return 'updated'
    } catch (error) {
      this.logger.debug(
        `Could not set the nickname of ${userId}: ${error instanceof Error ? error.message : String(error)}`
      )
      return 'failed'
    }
  }
}
