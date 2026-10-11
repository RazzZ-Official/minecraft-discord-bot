const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js')
const { serverInfoMessage } = require('../embeds')
const { commands } = require('../../config')
const { cmdSlashTranslation, isChannelAllowed, getError } = require('../index')

module.exports = {
  data: new SlashCommandBuilder()
    .setName(cmdSlashTranslation.serverinfo.name)
    .setDescription(cmdSlashTranslation.serverinfo.description),
  run: async ({ interaction }) => {
    if (!isChannelAllowed(interaction.channelId, false)) {
      interaction.reply({
        content: cmdSlashTranslation.disabledChannelMsg,
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    // Uploading the banner can take longer than the 3 second reply window.
    await interaction.deferReply()
    try {
      const canMention = Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone))
      await interaction.editReply(await serverInfoMessage({ canMention }))
    } catch (error) {
      await interaction.editReply(cmdSlashTranslation.serverinfo.errorReply).catch(() => {})
      getError(error, 'serverInfoCmd')
    }
  },
  options: {
    deleted: !commands.serverinfo.enabled || !commands.slashCommands, // Deletes the command from Discord
  },
}
