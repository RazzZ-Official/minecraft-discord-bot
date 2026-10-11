const { PermissionFlagsBits } = require('discord.js')
const { whitelist } = require('../../config')

/** Staff actions are only allowed in the staff channel, by members with a staff role (or Administrators if none set). */
const isStaff = (interaction) => {
  if (!interaction.inGuild() || interaction.channelId !== whitelist.staffChannelId) return false
  if (!whitelist.staffRoleIds.length) return interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
  const { roles } = interaction.member
  const roleIds = Array.isArray(roles) ? roles : [...roles.cache.keys()]
  return roleIds.some((roleId) => whitelist.staffRoleIds.includes(roleId))
}

module.exports = { isStaff }
