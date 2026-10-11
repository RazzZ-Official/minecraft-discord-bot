import { PermissionFlagsBits } from 'discord.js'
import type { Interaction } from 'discord.js'

/**
 * Limits an action to members with one of the roles, optionally in one channel. With no roles configured, only
 * Administrators are allowed, so a missing setting never opens a feature to everyone.
 */
export class RoleGuard {
  constructor(
    private readonly roleIds: readonly string[],
    private readonly channelId?: string
  ) {}

  hasRole(interaction: Interaction): boolean {
    if (!interaction.inGuild()) return false
    if (!this.roleIds.length) return interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
    const { roles } = interaction.member
    const memberRoleIds = Array.isArray(roles) ? roles : [...roles.cache.keys()]
    return memberRoleIds.some((roleId) => this.roleIds.includes(roleId))
  }

  inChannel(interaction: Interaction): boolean {
    return !this.channelId || interaction.channelId === this.channelId
  }

  allows(interaction: Interaction): boolean {
    return this.inChannel(interaction) && this.hasRole(interaction)
  }
}
