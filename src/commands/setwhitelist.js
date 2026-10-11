const { SlashCommandBuilder, MessageFlags, InteractionContextType } = require('discord.js')
const { whitelist, commands } = require('../../config')
const { cmdSlashTranslation, getError } = require('../index')
const { requestPanelMessage } = require('../whitelist/embeds')
const { hasStaffRole } = require('../whitelist/staff')

const text = cmdSlashTranslation.whitelist

module.exports = {
  data: new SlashCommandBuilder()
    .setName(text.setup.name)
    .setDescription(text.setup.description)
    .setContexts(InteractionContextType.Guild),
  run: async ({ interaction }) => {
    if (!hasStaffRole(interaction)) {
      interaction.reply({ content: text.replies.notStaff, flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    try {
      await interaction.channel.send(requestPanelMessage())
      await interaction.editReply(text.replies.panelPosted.replace(/\{channel\}/gi, `<#${interaction.channelId}>`))
    } catch (error) {
      await interaction.editReply(text.replies.error).catch(() => {})
      getError(error, 'whitelistRequest')
    }
  },
  options: {
    deleted: !whitelist.enabled || !commands.slashCommands, // Deletes the command from Discord
  },
}
