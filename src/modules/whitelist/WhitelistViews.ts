import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import type { BaseMessageOptions } from 'discord.js'
import type { BotConfig } from '../../config/types.js'
import { CustomId } from '../../core/CustomId.js'
import { Banner } from '../../shared/Banner.js'
import { editionName, fill } from '../../shared/format.js'
import { WhitelistIds, WhitelistText } from './messages.js'
import { PlayerName } from './PlayerName.js'
import type { WhitelistEntry } from './PlayerName.js'
import type { WhitelistRequest } from './WhitelistRequestModel.js'

const text = WhitelistText.embeds
const STATUS_COLORS = { pending: 'Yellow', processing: 'Orange', approved: 'Green', rejected: 'Red' } as const
// Embed field values are limited to 1024 characters.
const FIELD_VALUE_LIMIT = 1024
const REASON_MAX_LENGTH = 500

/** Every embed, button and modal of the whitelist feature. */
export class WhitelistViews {
  private readonly panelBanner: Banner

  constructor(private readonly config: BotConfig) {
    this.panelBanner = new Banner(config.whitelist.banner)
  }

  /** Short status text, eg. "Approved by @staff". */
  statusText(request: WhitelistRequest, processing = false): string {
    if (processing) return text.processing
    if (request.status === 'pending') return text.pending
    return fill(text[request.status], { staff: `<@${request.decidedBy}>` })
  }

  /** The request in the staff channel. Approve and Reject buttons are shown while it is pending. */
  staffRequestMessage(request: WhitelistRequest, processing = false): BaseMessageOptions {
    const embed = new EmbedBuilder()
      .setColor(STATUS_COLORS[processing ? 'processing' : request.status])
      .setAuthor({ name: this.config.server.name, iconURL: this.config.server.icon })
      .setTitle(text.requestTitle)
      .addFields(
        { name: text.discordUser, value: `<@${request.userId}> (${request.userTag})`, inline: true },
        { name: text.edition, value: editionName(request.edition), inline: true },
        { name: text.username, value: `\`${request.username}\``, inline: true },
        { name: text.whitelistName, value: `\`${request.whitelistName}\``, inline: true },
        { name: text.status, value: this.statusText(request, processing), inline: true }
      )
      .setFooter({ text: `ID: ${request.requestId}` })
      .setTimestamp(request.createdAt)
    if (request.status === 'rejected') embed.addFields({ name: text.reason, value: request.reason ?? text.noReason })
    if (request.status !== 'pending') return { embeds: [embed], components: [] }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CustomId.build(WhitelistIds.approve, request.requestId))
        .setLabel(text.approveButton)
        .setStyle(ButtonStyle.Success)
        .setDisabled(processing),
      new ButtonBuilder()
        .setCustomId(CustomId.build(WhitelistIds.reject, request.requestId))
        .setLabel(text.rejectButton)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(processing)
    )
    return { embeds: [embed], components: [buttons] }
  }

  rejectReasonModal(requestId: string): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(CustomId.build(WhitelistIds.rejectReason, requestId))
      .setTitle(text.rejectModalTitle)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel(text.rejectReasonLabel)
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId('reason')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(REASON_MAX_LENGTH)
          )
      )
  }

  /** Direct message telling the player the decision. */
  decisionDm(request: WhitelistRequest): BaseMessageOptions {
    const approved = request.status === 'approved'
    const values = { username: request.whitelistName, server: this.config.server.name }
    const embed = new EmbedBuilder()
      .setColor(STATUS_COLORS[approved ? 'approved' : 'rejected'])
      .setAuthor({ name: this.config.server.name, iconURL: this.config.server.icon })
      .setTitle(approved ? text.dmApprovedTitle : text.dmRejectedTitle)
      .setDescription(fill(approved ? text.dmApprovedDescription : text.dmRejectedDescription, values))
      .setTimestamp()
    if (!approved) embed.addFields({ name: text.reason, value: request.reason ?? text.noReason })
    return { embeds: [embed] }
  }

  /** The whitelist grouped by edition. */
  listMessage(entries: WhitelistEntry[]): BaseMessageOptions {
    const namesFor = (edition: 'java' | 'bedrock'): string[] =>
      entries
        .filter((entry) => PlayerName.entryEdition(entry) === edition)
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    const java = namesFor('java')
    const bedrock = namesFor('bedrock')
    const embed = new EmbedBuilder()
      .setColor('Aqua')
      .setAuthor({ name: this.config.server.name, iconURL: this.config.server.icon })
      .setTitle(fill(text.listTitle, { count: entries.length }))
      .addFields(
        { name: `Java (${java.length})`, value: this.joinNames(java) },
        { name: `Bedrock (${bedrock.length})`, value: this.joinNames(bedrock) }
      )
      .setTimestamp()
    return { embeds: [embed] }
  }

  /** Info card with the button that opens the request form, posted with /setwhitelist. */
  requestPanelMessage(): BaseMessageOptions {
    const { name, icon } = this.config.server
    const embed = new EmbedBuilder()
      .setColor('Green')
      .setAuthor({ name, iconURL: icon })
      .setTitle(fill(WhitelistText.panel.title, { name }))
      .setDescription(fill(WhitelistText.panel.description, { name }))
      .setThumbnail(icon)
      .setFooter({ text: WhitelistText.panel.footer })
    const banner = this.panelBanner.resolve()
    if (banner.imageUrl) embed.setImage(banner.imageUrl)

    const button = new ButtonBuilder()
      .setCustomId(WhitelistIds.openForm)
      .setLabel(WhitelistText.panel.button)
      .setEmoji('📝')
      .setStyle(ButtonStyle.Success)
    return {
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
      files: banner.files,
    }
  }

  /** Form where players enter their username and pick their edition. */
  requestFormModal(): ModalBuilder {
    const form = WhitelistText.form
    return new ModalBuilder()
      .setCustomId(WhitelistIds.submitForm)
      .setTitle(form.title)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(form.info))
      .addLabelComponents(
        new LabelBuilder()
          .setLabel(form.usernameLabel)
          .setDescription(form.usernameDescription)
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId('username')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(form.usernamePlaceholder)
              .setRequired(true)
              .setMaxLength(32)
          ),
        new LabelBuilder()
          .setLabel(form.editionLabel)
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId('edition')
              .setPlaceholder(form.editionPlaceholder)
              .setRequired(true)
              .addOptions(
                { label: 'Java', value: 'java', emoji: '💻' },
                { label: 'Bedrock', value: 'bedrock', emoji: '📱' }
              )
          )
      )
  }

  // Joins names into one field value, ending with "...and N more" if the full list would not fit.
  private joinNames(names: string[]): string {
    if (!names.length) return '-'
    const formatted = names.map((name) => `\`${name}\``)
    if (formatted.join(', ').length <= FIELD_VALUE_LIMIT) return formatted.join(', ')
    const more = (count: number): string => fill(text.listMore, { count })
    const shown: string[] = []
    for (const name of formatted) {
      const remaining = formatted.length - shown.length - 1
      if (`${[...shown, name].join(', ')}\n${more(remaining)}`.length > FIELD_VALUE_LIMIT) break
      shown.push(name)
    }
    return `${shown.join(', ')}\n${more(formatted.length - shown.length)}`
  }
}
