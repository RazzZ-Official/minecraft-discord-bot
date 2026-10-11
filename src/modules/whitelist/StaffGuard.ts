import { PermissionFlagsBits } from 'discord.js'
import type { Interaction } from 'discord.js'
import type { WhitelistConfig } from '../../config/types.js'

/** Decides who counts as whitelist staff. */
export class StaffGuard {
  constructor(private readonly config: WhitelistConfig) {}

  /** Members with a staff role, or Administrators when no staff roles are set. */
  isStaff(interaction: Interaction): boolean {
    if (!interaction.inGuild()) return false
    if (!this.config.staffRoleIds.length)
      return Boolean(interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
    const { roles } = interaction.member
    const roleIds = Array.isArray(roles) ? roles : [...roles.cache.keys()]
    return roleIds.some((roleId) => this.config.staffRoleIds.includes(roleId))
  }

  /** Reviewing requests and managing the whitelist is only allowed in the staff channel. */
  canReview(interaction: Interaction): boolean {
    return interaction.channelId === this.config.staffChannelId && this.isStaff(interaction)
  }
}
