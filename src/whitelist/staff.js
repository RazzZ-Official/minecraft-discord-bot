const { PermissionFlagsBits } = require('discord.js')
const { whitelist } = require('../../config')

/** Whether the member has a staff role, or is an Administrator if no staff roles are set. */
const hasStaffRole = (interaction) => {
  if (!interaction.inGuild()) return false
  if (!whitelist.staffRoleIds.length) return interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
  const { roles } = interaction.member
  const roleIds = Array.isArray(roles) ? roles : [...roles.cache.keys()]
  return roleIds.some((roleId) => whitelist.staffRoleIds.includes(roleId))
}

/** Reviewing requests and managing the whitelist is only allowed in the staff channel, by staff. */
const isStaff = (interaction) => interaction.channelId === whitelist.staffChannelId && hasStaffRole(interaction)

module.exports = { hasStaffRole, isStaff }
