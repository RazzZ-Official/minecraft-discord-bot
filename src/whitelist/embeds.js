const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  TextDisplayBuilder,
  StringSelectMenuBuilder,
} = require('discord.js')
const { mcserver, whitelist } = require('../../config')
const { cmdSlashTranslation } = require('../index')
const { bannerImage } = require('../embeds')
const { parseWhitelistEntry } = require('./username')

const text = cmdSlashTranslation.whitelist

const CUSTOM_ID = {
  approve: 'whitelist:approve',
  reject: 'whitelist:reject',
  rejectReason: 'whitelist:reject-reason',
}

// The request panel uses its own prefix, so the staff decision handler never picks these up.
const PANEL_ID = {
  openForm: 'whitelist-panel:open',
  submitForm: 'whitelist-panel:submit',
}

const STATUS_COLORS = {
  pending: 'Yellow',
  processing: 'Orange',
  approved: 'Green',
  rejected: 'Red',
}

const editionName = (edition) => (edition === 'bedrock' ? 'Bedrock' : 'Java')

const statusText = (request, processing) => {
  if (processing) return text.embeds.processing
  if (request.status === 'pending') return text.embeds.pending
  return text.embeds[request.status].replace(/\{staff\}/gi, `<@${request.decidedBy}>`)
}

/** Builds the staff channel message for a request. Buttons are only shown while the request is pending. */
const staffRequestMessage = (request, { processing = false } = {}) => {
  const embed = new EmbedBuilder()
    .setColor(STATUS_COLORS[processing ? 'processing' : request.status])
    .setAuthor({ name: mcserver.name, iconURL: mcserver.icon })
    .setTitle(text.embeds.requestTitle)
    .addFields(
      { name: text.embeds.discordUser, value: `<@${request.userId}> (${request.userTag})`, inline: true },
      { name: text.embeds.edition, value: editionName(request.edition), inline: true },
      { name: text.embeds.username, value: `\`${request.username}\``, inline: true },
      { name: text.embeds.whitelistName, value: `\`${request.whitelistName}\``, inline: true },
      { name: text.embeds.status, value: statusText(request, processing), inline: true }
    )
    .setFooter({ text: `ID: ${request.id}` })
    .setTimestamp(new Date(request.createdAt))
  if (request.status === 'rejected') {
    embed.addFields({ name: text.embeds.reason, value: request.reason || text.embeds.noReason })
  }

  const components =
    request.status === 'pending'
      ? [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${CUSTOM_ID.approve}:${request.id}`)
              .setLabel(text.embeds.approveButton)
              .setStyle(ButtonStyle.Success)
              .setDisabled(processing),
            new ButtonBuilder()
              .setCustomId(`${CUSTOM_ID.reject}:${request.id}`)
              .setLabel(text.embeds.rejectButton)
              .setStyle(ButtonStyle.Danger)
              .setDisabled(processing)
          ),
        ]
      : []

  return { embeds: [embed], components }
}

const rejectReasonModal = (request) =>
  new ModalBuilder()
    .setCustomId(`${CUSTOM_ID.rejectReason}:${request.id}`)
    .setTitle(text.embeds.rejectModalTitle)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel(text.embeds.rejectReasonLabel)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500)
      )
    )

/** Direct message sent to the player once their request has been decided. */
const decisionDm = (request) => {
  const approved = request.status === 'approved'
  const replaceFields = (string) =>
    string.replace(/\{username\}/gi, request.whitelistName).replace(/\{server\}/gi, mcserver.name)
  const embed = new EmbedBuilder()
    .setColor(STATUS_COLORS[request.status])
    .setAuthor({ name: mcserver.name, iconURL: mcserver.icon })
    .setTitle(replaceFields(approved ? text.embeds.dmApprovedTitle : text.embeds.dmRejectedTitle))
    .setDescription(replaceFields(approved ? text.embeds.dmApprovedDescription : text.embeds.dmRejectedDescription))
    .setTimestamp()
  if (!approved) embed.addFields({ name: text.embeds.reason, value: request.reason || text.embeds.noReason })
  return { embeds: [embed] }
}

/** Entry posted to the log channel for every decision. */
const decisionLog = (request) => {
  const embed = new EmbedBuilder()
    .setColor(STATUS_COLORS[request.status])
    .setTitle(text.embeds.logTitle)
    .addFields(
      { name: text.embeds.discordUser, value: `<@${request.userId}> (${request.userTag})`, inline: true },
      { name: text.embeds.whitelistName, value: `\`${request.whitelistName}\``, inline: true },
      { name: text.embeds.edition, value: editionName(request.edition), inline: true },
      { name: text.embeds.status, value: statusText(request), inline: true },
      { name: text.embeds.playerNotified, value: request.notified ? '✅' : '❌', inline: true }
    )
    .setFooter({ text: `ID: ${request.id}` })
    .setTimestamp(new Date(request.decidedAt))
  if (request.status === 'rejected') {
    embed.addFields({ name: text.embeds.reason, value: request.reason || text.embeds.noReason })
  }
  return { embeds: [embed] }
}

// Embed field values are limited to 1024 characters.
const FIELD_VALUE_LIMIT = 1024

const entryEdition = (entry) => parseWhitelistEntry(entry)?.edition ?? 'java'

// Joins names into one field value, cutting off with "...and N more" when the full list would exceed the limit.
const joinNames = (names) => {
  if (!names.length) return '-'
  const formatted = names.map((name) => `\`${name}\``)
  if (formatted.join(', ').length <= FIELD_VALUE_LIMIT) return formatted.join(', ')
  const more = (count) => text.embeds.listMore.replace(/\{count\}/gi, count)
  const shown = []
  for (const name of formatted) {
    const remaining = formatted.length - shown.length - 1
    if (`${[...shown, name].join(', ')}\n${more(remaining)}`.length > FIELD_VALUE_LIMIT) break
    shown.push(name)
  }
  return `${shown.join(', ')}\n${more(formatted.length - shown.length)}`
}

/** Lists the current whitelist entries, grouped by edition. */
const whitelistListMessage = (entries) => {
  const names = (edition) =>
    entries
      .filter((entry) => entryEdition(entry) === edition)
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  const java = names('java')
  const bedrock = names('bedrock')
  const embed = new EmbedBuilder()
    .setColor('Aqua')
    .setAuthor({ name: mcserver.name, iconURL: mcserver.icon })
    .setTitle(text.embeds.listTitle.replace(/\{count\}/gi, entries.length))
    .addFields(
      { name: `Java (${java.length})`, value: joinNames(java) },
      { name: `Bedrock (${bedrock.length})`, value: joinNames(bedrock) }
    )
    .setTimestamp()
  return { embeds: [embed] }
}

/** Entry posted to the log channel when staff remove a player. */
const removalLog = (entry, staffId) => {
  const embed = new EmbedBuilder()
    .setColor('DarkRed')
    .setTitle(text.embeds.logRemovalTitle)
    .addFields(
      { name: text.embeds.whitelistName, value: `\`${entry.name}\``, inline: true },
      { name: text.embeds.edition, value: editionName(entryEdition(entry)), inline: true },
      { name: text.embeds.removedBy, value: `<@${staffId}>`, inline: true }
    )
    .setTimestamp()
  return { embeds: [embed] }
}

/** Info card with the button that opens the request form, posted with /setwhitelist. */
const requestPanelMessage = () => {
  const embed = new EmbedBuilder()
    .setColor('Green')
    .setAuthor({ name: mcserver.name, iconURL: mcserver.icon })
    .setTitle(text.panel.title.replace(/\{name\}/gi, mcserver.name))
    .setDescription(text.panel.description.replace(/\{name\}/gi, mcserver.name))
    .setThumbnail(mcserver.icon)
    .setFooter({ text: text.panel.footer })
  const { imageUrl, files } = bannerImage(whitelist.banner)
  if (imageUrl) embed.setImage(imageUrl)

  const button = new ButtonBuilder()
    .setCustomId(PANEL_ID.openForm)
    .setLabel(text.panel.button)
    .setEmoji('📝')
    .setStyle(ButtonStyle.Success)
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)], files }
}

/** Form where players enter their username and pick their edition. */
const requestFormModal = () =>
  new ModalBuilder()
    .setCustomId(PANEL_ID.submitForm)
    .setTitle(text.form.title)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text.form.info))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(text.form.usernameLabel)
        .setDescription(text.form.usernameDescription)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('username')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(text.form.usernamePlaceholder)
            .setRequired(true)
            .setMaxLength(32)
        ),
      new LabelBuilder()
        .setLabel(text.form.editionLabel)
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('edition')
            .setPlaceholder(text.form.editionPlaceholder)
            .setRequired(true)
            .addOptions(
              { label: 'Java', value: 'java', emoji: '💻' },
              { label: 'Bedrock', value: 'bedrock', emoji: '📱' }
            )
        )
    )

module.exports = {
  CUSTOM_ID,
  PANEL_ID,
  requestPanelMessage,
  requestFormModal,
  editionName,
  entryEdition,
  statusText,
  staffRequestMessage,
  rejectReasonModal,
  decisionDm,
  decisionLog,
  whitelistListMessage,
  removalLog,
}
