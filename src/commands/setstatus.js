const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js')
const { statusMessageEdit, consoleLogTranslation, cmdSlashTranslation, getError } = require('../index')
const { autoChangeStatus, mcserver } = require('../../config')
const { mentionFor } = require('../embeds')
const chalk = require('chalk')
const fs = require('fs')

// All options are optional and default to the mcserver settings in the config.
let data = new SlashCommandBuilder()
  .setName(cmdSlashTranslation.setstatus.name)
  .setDescription(cmdSlashTranslation.setstatus.description)
  .addStringOption((option) => option.setName('name').setDescription(cmdSlashTranslation.setstatus.serverName))
  .addStringOption((option) => option.setName('ip').setDescription(cmdSlashTranslation.setstatus.serverIp))
  .addIntegerOption((option) =>
    option.setName('port').setDescription(cmdSlashTranslation.setstatus.serverPort).setMinValue(1).setMaxValue(65535)
  )
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription(cmdSlashTranslation.setstatus.serverType)
      .addChoices({ name: 'Java', value: 'java' }, { name: 'Bedrock', value: 'bedrock' })
  )

if (autoChangeStatus.adminOnly) {
  data.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
}

let run = async ({ interaction, client }) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  try {
    if (!autoChangeStatus.enabled) {
      interaction.editReply({
        content: cmdSlashTranslation.setstatus.enableFeature,
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    const channel = client.channels.cache.get(interaction.channelId)
    // The mention pings once when the message is created; later status updates are edits, which never ping.
    const canMention = Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone))
    const mention = canMention ? autoChangeStatus.mention : ''
    const { text: mentionText, allowedMentions } = mentionFor(mention)
    const msg = await channel.send({
      content: `${mentionText} ${cmdSlashTranslation.setstatus.checkingStatusCmdMsg}`.trim(),
      allowedMentions,
    })
    const readData = fs.readFileSync('./src/data.json', 'utf8')
    const ip = interaction.options.getString('ip') || mcserver.ip
    const port = interaction.options.getInteger('port') || mcserver.port
    const type = interaction.options.getString('type') || mcserver.type
    const name = interaction.options.getString('name') || mcserver.name

    let dataRead = await JSON.parse(readData)

    if (!ip.includes('.')) {
      throw { message: `Invalid IP "${ip}"` }
    }

    dataRead.autoChangeStatus.push({
      ip,
      port,
      type,
      name,
      channelId: interaction.channelId,
      messageId: msg.id,
      mention,
    })
    await statusMessageEdit(ip, port, type, name, msg, mention)
    fs.writeFileSync('./src/data.json', JSON.stringify(dataRead, null, 2), 'utf8')
    interaction.editReply({
      content: cmdSlashTranslation.setstatus.statusMsgSuccess
        .replace(/\{channel\}/gi, `<#${interaction.channelId}>`)
        .replace(/\{messageLink\}/gi, `https://discord.com/channels/${msg.guildId}/${interaction.channelId}/${msg.id}`),
      flags: MessageFlags.Ephemeral,
    })
    console.log(
      consoleLogTranslation.debug.autoChangeStatus.successLog.replace(
        /\{channelName\}/gi,
        chalk.cyan(`#${msg.channel.name}`)
      )
    )
  } catch (error) {
    interaction.editReply({
      content: cmdSlashTranslation.setstatus.errorReply.replace(/\{error\}/gi, error.message),
      flags: MessageFlags.Ephemeral,
    })
    if (error.message.startsWith('Invalid IP')) return
    getError(error, 'setStatus')
  }
}

module.exports = { data, run }
