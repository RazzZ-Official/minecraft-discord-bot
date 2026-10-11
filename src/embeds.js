const { EmbedBuilder, AttachmentBuilder } = require('discord.js')
const path = require('node:path')
const { mcserver, commands, settings, serverInfo, autoChangeStatus } = require('../config')
const { embedTranslation } = require('./index')
const { isFloodgatePlayer } = require('./whitelist/username')

const ipBedrock = `IP: \`${mcserver.ip}\`\nPort: \`${mcserver.port}\``
const port = mcserver.port === 25565 ? '' : `:\`${mcserver.port}\``
const ipJava = `**IP: \`${mcserver.ip}\`${port}**`
const ip = mcserver.type === 'bedrock' ? ipBedrock : ipJava

// Embed Message for site commands
const siteEmbed = new EmbedBuilder()
  .setColor(settings.embedsColors.basicCmds)
  .setThumbnail(mcserver.icon)
  .setAuthor({
    name: mcserver.name,
  })
  .setTitle(embedTranslation.site.title.replace(/\{site\}/gi, mcserver.site))
  .setDescription(embedTranslation.site.description.replace(/\{site\}/gi, mcserver.site))

// Embed Message for version commands
const versionEmbed = new EmbedBuilder()
  .setColor(settings.embedsColors.basicCmds)
  .setThumbnail(mcserver.icon)
  .setAuthor({
    name: mcserver.name,
  })
  .setTitle(embedTranslation.version.title.replace(/\{version\}/gi, mcserver.version))
  .setDescription(embedTranslation.version.description.replace(/\{version\}/gi, mcserver.version))

// Embed Message for ip commands
const ipEmbed = new EmbedBuilder()
  .setColor(settings.embedsColors.basicCmds)
  .setThumbnail(mcserver.icon)
  .setAuthor({
    name: mcserver.name,
  })
  .setTitle(embedTranslation.ip.title.replace(/\{ip\}/gi, ip))
  .setDescription(embedTranslation.ip.description.replace(/\{ip\}/gi, ip))

// Offline Embed Message status commands
const offlineStatus = () => {
  const offlineEmbed = new EmbedBuilder()
    .setColor(settings.embedsColors.offline)
    .setTitle(
      embedTranslation.offlineEmbed.title
        .replace(/\{ip\}/gi, ip)
        .replace(/\{version\}/gi, mcserver.version)
        .replace(/\{site\}/gi, mcserver.site)
    )
    .setThumbnail(mcserver.icon)
    .setAuthor({
      name: mcserver.name,
    })
    .setTimestamp()
    .setFooter({ text: embedTranslation.offlineEmbed.footer })
  if (embedTranslation.offlineEmbed.description) {
    offlineEmbed.setDescription(
      embedTranslation.offlineEmbed.description
        .replace(/\{ip\}/gi, ip)
        .replace(/\{version\}/gi, mcserver.version)
        .replace(/\{site\}/gi, mcserver.site)
    )
  }
  return offlineEmbed
}

// MOTD Embed for motd commands
const motdEmbed = async () => {
  const { getServerDataAndPlayerList } = require('./index')
  const { data, isOnline } = await getServerDataAndPlayerList(true)
  if (!isOnline) {
    return offlineStatus()
  } else {
    return new EmbedBuilder()
      .setColor(settings.embedsColors.online)
      .setThumbnail(mcserver.icon)
      .setAuthor({
        name: mcserver.name,
      })
      .setTitle(embedTranslation.motd.title.replace(/\{motd\}/gi, data.motd.clean))
      .setDescription(embedTranslation.motd.description.replace(/\{motd\}/gi, data.motd.clean))
      .setFooter({ text: 'Checked at' })
      .setTimestamp()
  }
}
// Embed Message for players commands
const playerList = async () => {
  try {
    const { getServerDataAndPlayerList } = require('./index')
    const { playerListArray, isOnline } = await getServerDataAndPlayerList()
    if (!isOnline) {
      return offlineStatus()
    } else {
      return new EmbedBuilder()
        .setColor(settings.embedsColors.online)
        .setThumbnail(mcserver.icon)
        .setAuthor({
          name: mcserver.name,
        })
        .addFields(playerListArray)
        .setTimestamp()
        .setFooter({ text: embedTranslation.offlineEmbed.footer })
    }
  } catch (error) {
    const { getError } = require('./index')
    getError(error, 'playerEmbed')
  }
}

// Online Embed Message for status commands
const statusEmbed = async () => {
  const { getServerDataAndPlayerList } = require('./index')
  const { data, playerListArray, isOnline } = await getServerDataAndPlayerList()
  if (isOnline) {
    return await OnlineEmbed(data, playerListArray)
  } else {
    return offlineStatus()
  }
}

// Online Embed Message for status commands
const OnlineEmbed = async (data, playerlist) => {
  try {
    function editDescriptionFields(description) {
      let siteText = mcserver.site ? embedTranslation.onlineEmbed.siteText.replace(/\{site\}/gi, mcserver.site) : ''
      let string = description
        .trim()
        .replace(/\{ip\}/gi, ip)
        .replace(/\{motd\}/gi, data.motd.clean)
        .replace(/\{version\}/gi, mcserver.version)
        .replace(/\{siteText\}/gi, siteText)
      return string
    }
    let description_field_one = editDescriptionFields(embedTranslation.onlineEmbed.description_field_one)
    let description_field_two = editDescriptionFields(embedTranslation.onlineEmbed.description_field_two)
    let title = editDescriptionFields(embedTranslation.onlineEmbed.title)
    return new EmbedBuilder()
      .setColor(settings.embedsColors.online)
      .setThumbnail(mcserver.icon)
      .setAuthor({
        name: mcserver.name,
      })
      .setTitle(title)
      .addFields(playerlist)
      .addFields({
        name: description_field_one,
        value: description_field_two,
      })
      .setTimestamp()
      .setFooter({ text: embedTranslation.onlineEmbed.footer })
  } catch (error) {
    const { getError } = require('./index')
    getError(error, 'statusEmbed')
  }
}

const helpEmbed = async (client, commandName) => {
  const commandsFetch = await client.application.commands.fetch()
  if (commandName) {
    let slashCmdData
    await commandsFetch.forEach((slashCmd) => {
      if (slashCmd.name === commandName) {
        slashCmdData = slashCmd
      }
    })
    return new EmbedBuilder()
      .setAuthor({
        name: client.user.username,
        iconURL: client.user.avatarURL(),
      })
      .setColor('Yellow')
      .setTitle(
        embedTranslation.help.commandInfoFormat.title.replace(
          /\{cmdName\}/gi,
          slashCmdData.name.charAt(0).toUpperCase() + slashCmdData.name.slice(1)
        )
      )
      .setDescription(
        embedTranslation.help.commandInfoFormat.description
          .replace(/\{cmdSlashMention\}/gi, `</${slashCmdData.name}:${slashCmdData.id}>`)
          .replace(/\{cmdDescription\}/gi, slashCmdData.description)
          .replace(/\{prefixCmd\}/gi, commands.prefixCommands.prefix + slashCmdData.name)
          .replace(
            /\{prefixCmdAlias\}/gi,
            commands[slashCmdData.name].alias.length ? `\`${commands[slashCmdData.name].alias.join('`, `')}\`` : ''
          )
      )
  }

  visibleCmdsNames = []
  // Get the commands enabled from config and add to visibleCmdsNames
  for (const cmds in commands) {
    if (commands[cmds].enabled) {
      visibleCmdsNames.push(cmds)
    }
  }
  const cmdsList = []

  // If commands in fetched data is in the config and enabled then it will show in embed
  commandsFetch.forEach((command) => {
    if (visibleCmdsNames.includes(command.name)) {
      cmdsList.push(
        embedTranslation.help.listFormat
          .replace(/\{slashCmdMention\}/gi, `</${command.name}:${command.id}>`)
          .replace(/\{cmdDescription\}/gi, command.description)
      )
    }
  })

  return new EmbedBuilder()
    .setTitle(embedTranslation.help.title.replace(/\{prefix\}/gi).replace(/\{botName\}/gi, client.user.username))
    .setColor('Yellow')
    .setAuthor({
      name: client.user.username,
      iconURL: client.user.avatarURL(),
    })
    .setDescription(
      `${embedTranslation.help.description
        .replace(/\{prefix\}/gi, commands.prefixCommands.prefix)
        .replace(/\{botName\}/gi, client.user.username)}\n${cmdsList.join('\n')}`
    )
}

const botInfoEmbed = async (interaction, client) => {
  const process = require('node:process')
  const reply = await interaction.fetchReply()
  const ping = reply.createdTimestamp - interaction.createdTimestamp
  const os = require('os')
  const cpuUsage = (os.loadavg()[0] / os.cpus().length).toFixed(2)
  const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
  const nodeVersion = process.version
  const uptimeSeconds = Math.floor(process.uptime())
  const uptimeMinutes = Math.floor(uptimeSeconds / 60) % 60
  const uptimeHours = Math.floor(uptimeMinutes / 60) % 24
  const uptimeDays = Math.floor(uptimeHours / 24)
  return new EmbedBuilder()
    .setAuthor({
      name: client.user.tag,
      iconURL: client.user.avatarURL(),
    })
    .setTitle(embedTranslation.info.title)
    .setColor('Yellow')
    .setDescription(
      embedTranslation.info.description
        .replace(/\{cpuUsage\}/gi, cpuUsage)
        .replace(/\{memoryUsage\}/gi, memoryUsage)
        .replace(/\{nodeVersion\}/gi, nodeVersion)
        .replace(/\{uptimeDays\}/gi, uptimeDays)
        .replace(/\{uptimeHours\}/gi, uptimeHours)
        .replace(/\{uptimeMinutes\}/gi, uptimeMinutes)
        .replace(/\{uptimeSeconds\}/gi, uptimeSeconds)
        .replace(/\{ping\}/gi, ping)
        .replace(/\{websocket\}/gi, client.ws.ping)
    )
}

/**
 * Resolves a banner setting to an embed image. A local file is attached to the message so its link never expires.
 * Files already attached to the message being edited are not uploaded again.
 */
const bannerImage = (banner, attachedFileNames = []) => {
  if (!banner) return { imageUrl: null, files: [] }
  if (/^https?:\/\//i.test(banner)) return { imageUrl: banner, files: [] }
  const fileName = path.basename(banner)
  const files = attachedFileNames.includes(fileName)
    ? []
    : [new AttachmentBuilder(path.resolve(banner), { name: fileName })]
  return { imageUrl: `attachment://${fileName}`, files }
}

// Turns a multi-line MOTD into a single line.
const cleanMotd = (motd) => (motd ?? '').replace(/\s+/g, ' ').trim()

// Mention text and allowed mentions for a mention setting: "everyone", "here", a role ID, or "" for none.
const mentionFor = (mention) => {
  if (mention === 'everyone' || mention === 'here')
    return { text: `@${mention}`, allowedMentions: { parse: ['everyone'] } }
  if (mention) return { text: `<@&${mention}>`, allowedMentions: { roles: [mention] } }
  return { text: '', allowedMentions: { parse: [] } }
}

/**
 * Message for the serverinfo commands. The addresses and the live MOTD come from the mcserver settings.
 * @param canMention Whether the member who ran the command may ping, so the mention cannot be abused.
 */
const serverInfoMessage = async ({ canMention = false } = {}) => {
  const { getServerDataAndPlayerList } = require('./index')
  const { data, isOnline } = (await getServerDataAndPlayerList(true)) ?? {}
  const motd = isOnline ? cleanMotd(data.motd?.clean) : ''
  const fillFields = (string) => string.replace(/\{name\}/gi, mcserver.name).replace(/\{motd\}/gi, motd)
  const text = embedTranslation.serverInfo
  const description = [
    fillFields(text.welcome),
    // The MOTD line is left out while the server is offline.
    motd && `> ${fillFields(text.motd)}`,
    `${text.java}\n\`\`\`\n${mcserver.ip}\n\`\`\``,
    `${text.bedrock}\n\`\`\`\n${mcserver.ip}:${mcserver.port}\n\`\`\``,
    text.copyHint,
  ]
    .filter(Boolean)
    .join('\n\n')

  const embed = new EmbedBuilder()
    .setColor(serverInfo.color)
    .setAuthor({ name: fillFields(text.author), iconURL: mcserver.icon })
    .setDescription(description)
    .setFooter({ text: fillFields(text.footer), iconURL: mcserver.icon })

  const { imageUrl, files } = bannerImage(serverInfo.banner)
  if (imageUrl) embed.setImage(imageUrl)

  const mention = mentionFor(canMention ? serverInfo.mention : '')
  return {
    content: fillFields(text.content)
      .replace(/\{mention\}/gi, mention.text)
      .trim(),
    embeds: [embed],
    files,
    allowedMentions: mention.allowedMentions,
  }
}

const PLAYER_BAR_SEGMENTS = 10
// Keeps the player table well within the 1024 character limit of an embed field.
const PLAYER_TABLE_MAX_ROWS = 15

const formatAddress = (ip, port, type) => (type === 'java' && port === 25565 ? ip : `${ip}:${port}`)

const formatUptime = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor(totalSeconds / 3600) % 24
  const minutes = Math.floor(totalSeconds / 60) % 60
  const seconds = totalSeconds % 60
  if (days) return `${days}d ${hours}h ${minutes}m`
  if (hours) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

const playerSlotsBar = (online, max) => {
  const ratio = max > 0 ? online / max : 0
  // Show at least one filled segment while anyone is online.
  const filled = online > 0 ? Math.min(PLAYER_BAR_SEGMENTS, Math.max(1, Math.round(ratio * PLAYER_BAR_SEGMENTS))) : 0
  return `${'🟩'.repeat(filled)}${'⬜'.repeat(PLAYER_BAR_SEGMENTS - filled)} (${online}/${max})`
}

const playerTable = (players, type) => {
  const text = embedTranslation.statusCard
  if (!players.online) return text.noPlayers
  const list = players.list ?? []
  if (!list.length) return text.playersHidden

  const rows = list.slice(0, PLAYER_TABLE_MAX_ROWS).map((player, index) => {
    const name = player.name_clean ?? player.name
    const isBedrock = type === 'bedrock' || isFloodgatePlayer({ uuid: player.uuid, name })
    return [String(index + 1), name, isBedrock ? 'Bedrock' : 'Java']
  })
  const header = ['#', text.tablePlayer, text.tablePlatform]
  const widths = header.map((_, column) => Math.max(...[header, ...rows].map((row) => row[column].length)))
  const formatRow = (row) =>
    row
      .map((cell, column) => cell.padEnd(widths[column]))
      .join('  ')
      .trimEnd()
  const lines = [formatRow(header), formatRow(widths.map((width) => '-'.repeat(width))), ...rows.map(formatRow)]

  const hiddenCount = players.online - rows.length
  const more = hiddenCount > 0 ? `\n${text.morePlayers.replace(/\{count\}/gi, hiddenCount)}` : ''
  return `\`\`\`\n${lines.join('\n')}\n\`\`\`${more}`
}

/**
 * Message for the auto-updating status set with /setstatus.
 * @param status Server status from node-mcstatus, plus the measured ping and the panel uptime (null when unknown).
 * @param options.attachedFileNames Names of files already attached to the message, so the banner is only uploaded once.
 * @param options.mention Mention saved when the status message was created. Discord does not ping on edits, so it
 *   only keeps the mention visible.
 */
const statusCardMessage = (
  { data, ip, port, type, name, isOnline, ping, uptime },
  { attachedFileNames = [], mention = '' } = {}
) => {
  const text = embedTranslation.statusCard
  const address = formatAddress(ip, port, type)
  const embed = new EmbedBuilder()
    .setAuthor({ name })
    // The configured logo is used for the main server, other servers show their own server icon.
    .setThumbnail(ip === mcserver.ip ? mcserver.icon : `https://api.mcstatus.io/v2/icon/${ip}:${port}`)
    .setTimestamp()

  if (isOnline) {
    const version = type === 'java' ? data.version?.name_clean : data.version?.name
    const motd = cleanMotd(data.motd?.clean)
    embed
      .setColor(settings.embedsColors.online)
      .setTitle(text.onlineTitle.replace(/\{name\}/gi, name))
      .setDescription(
        text.onlineDescription
          .replace(/\{motd\}/gi, motd || text.notAvailable)
          .replace(/\{ip\}/gi, address)
          .replace(/\{version\}/gi, version || text.notAvailable)
      )
      .addFields(
        { name: text.edition, value: type === 'bedrock' ? 'Bedrock' : 'Java', inline: true },
        { name: text.ping, value: ping === null ? text.notAvailable : `${ping}ms`, inline: true },
        { name: text.uptime, value: uptime === null ? text.notAvailable : formatUptime(uptime), inline: true },
        { name: text.playerSlots, value: playerSlotsBar(data.players.online, data.players.max) },
        { name: text.onlinePlayers, value: playerTable(data.players, type) }
      )
  } else {
    embed
      .setColor(settings.embedsColors.offline)
      .setTitle(text.offlineTitle.replace(/\{name\}/gi, name))
      .setDescription(text.offlineDescription.replace(/\{ip\}/gi, address))
  }

  const { imageUrl, files } = bannerImage(autoChangeStatus.banner, attachedFileNames)
  if (imageUrl) embed.setImage(imageUrl)
  const { text: mentionText, allowedMentions } = mentionFor(mention)
  return { content: mentionText, embeds: [embed], files, allowedMentions }
}

module.exports = {
  mentionFor,
  statusCardMessage,
  serverInfoMessage,
  versionEmbed,
  siteEmbed,
  offlineStatus,
  ipEmbed,
  ip,
  playerList,
  statusEmbed,
  OnlineEmbed,
  motdEmbed,
  helpEmbed,
  botInfoEmbed,
}
