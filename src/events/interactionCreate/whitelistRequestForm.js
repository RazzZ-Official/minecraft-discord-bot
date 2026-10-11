const { MessageFlags } = require('discord.js')
const { whitelist } = require('../../../config')
const { cmdSlashTranslation, getError } = require('../../index')
const { PANEL_ID, requestFormModal } = require('../../whitelist/embeds')
const { submitRequest } = require('../../whitelist/requests')

const text = cmdSlashTranslation.whitelist

// Opens the request form from the /setwhitelist panel and submits it.
// Nothing is returned from this handler, because a truthy return value stops CommandKit's event loop.
module.exports = async (interaction, client) => {
  const isOpenButton = interaction.isButton() && interaction.customId === PANEL_ID.openForm
  const isFormSubmit = interaction.isModalSubmit() && interaction.customId === PANEL_ID.submitForm
  if (!isOpenButton && !isFormSubmit) return

  try {
    if (!whitelist.enabled) {
      await interaction.reply({ content: text.replies.disabled, flags: MessageFlags.Ephemeral })
      return
    }
    if (isOpenButton) {
      await interaction.showModal(requestFormModal())
      return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const username = interaction.fields.getTextInputValue('username')
    const [edition] = interaction.fields.getStringSelectValues('edition')
    await interaction.editReply(await submitRequest(client, interaction.user, edition, username))
  } catch (error) {
    getError(error, 'whitelistRequest')
    const reply =
      interaction.deferred || interaction.replied
        ? interaction.editReply(text.replies.error)
        : interaction.reply({ content: text.replies.error, flags: MessageFlags.Ephemeral })
    await reply.catch(() => {})
  }
}
