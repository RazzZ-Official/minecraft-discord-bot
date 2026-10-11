import { EmbedBuilder } from 'discord.js'
import type { APIEmbedField, BaseMessageOptions } from 'discord.js'
import type { BotConfig } from '../../config/types.js'
import type { ServerStatus } from '../../services/MinecraftStatusService.js'
import { Banner } from '../../shared/Banner.js'
import { fill, singleLine } from '../../shared/format.js'
import type { Mention } from '../../shared/Mention.js'
import { ServerText } from './messages.js'

const PLAYER_COLUMNS = 3
// Invisible character, because embed field values cannot be empty.
const BLANK = '‎ '

/** Embeds for the public server info commands. */
export class ServerViews {
  private readonly serverInfoBanner: Banner

  constructor(private readonly config: BotConfig) {
    this.serverInfoBanner = new Banner(config.serverInfo.banner)
  }

  ipEmbed(): EmbedBuilder {
    const address = this.formattedAddress()
    return this.basicEmbed()
      .setTitle(fill(ServerText.ip.title, { ip: address }))
      .setDescription(fill(ServerText.ip.description, { ip: address }))
  }

  siteEmbed(): EmbedBuilder {
    const { site } = this.config.server
    return this.basicEmbed()
      .setTitle(fill(ServerText.site.title, { site }))
      .setDescription(fill(ServerText.site.description, { site }))
  }

  versionEmbed(): EmbedBuilder {
    const { version } = this.config.server
    return this.basicEmbed()
      .setTitle(fill(ServerText.version.title, { version }))
      .setDescription(fill(ServerText.version.description, { version }))
  }

  offlineEmbed(): EmbedBuilder {
    return this.serverEmbed(this.config.colors.offline)
      .setTitle(ServerText.offline.title)
      .setFooter({ text: ServerText.checkedAt })
      .setTimestamp()
  }

  motdEmbed(status: ServerStatus): EmbedBuilder {
    if (!status.online) return this.offlineEmbed()
    return this.serverEmbed(this.config.colors.online)
      .setTitle(fill(ServerText.motd.title, { motd: status.motd }))
      .setDescription(fill(ServerText.motd.description, { motd: status.motd }))
      .setFooter({ text: ServerText.checkedAt })
      .setTimestamp()
  }

  playersEmbed(status: ServerStatus): EmbedBuilder {
    if (!status.online) return this.offlineEmbed()
    return this.serverEmbed(this.config.colors.online)
      .addFields(this.playerFields(status))
      .setFooter({ text: ServerText.checkedAt })
      .setTimestamp()
  }

  statusEmbed(status: ServerStatus): EmbedBuilder {
    if (!status.online) return this.offlineEmbed()
    const { site, version } = this.config.server
    const values = {
      motd: status.motd,
      ip: this.formattedAddress(),
      version,
      siteText: site ? fill(ServerText.online.siteText, { site }) : '',
    }
    return this.serverEmbed(this.config.colors.online)
      .setTitle(ServerText.online.title)
      .addFields(this.playerFields(status))
      .addFields({
        name: fill(ServerText.online.detailsName, values),
        value: fill(ServerText.online.detailsValue, values),
      })
      .setFooter({ text: ServerText.checkedAt })
      .setTimestamp()
  }

  /** Card for /serverinfo. The MOTD line is left out while the server is offline. */
  serverInfoMessage(status: ServerStatus | null, mention: Mention): BaseMessageOptions {
    const { server, serverInfo } = this.config
    const text = ServerText.serverInfo
    const motd = status?.online ? singleLine(status.motd) : ''
    const values = { name: server.name, motd }
    const description = [
      fill(text.welcome, values),
      motd && `> ${fill(text.motd, values)}`,
      // Java players join through the domain's SRV record, so only Bedrock needs the port. Geyser shares it.
      `${text.java}\n\`\`\`\n${server.ip}\n\`\`\``,
      `${text.bedrock}\n\`\`\`\n${server.ip}:${server.port}\n\`\`\``,
      text.copyHint,
    ]
      .filter(Boolean)
      .join('\n\n')

    const embed = new EmbedBuilder()
      .setColor(serverInfo.color)
      .setAuthor({ name: fill(text.author, values), iconURL: server.icon })
      .setDescription(description)
      .setFooter({ text: text.footer, iconURL: server.icon })
    const banner = this.serverInfoBanner.resolve()
    if (banner.imageUrl) embed.setImage(banner.imageUrl)

    return {
      content: fill(text.content, { ...values, mention: mention.text }).trim(),
      embeds: [embed],
      files: banner.files,
      allowedMentions: mention.allowedMentions,
    }
  }

  /** "IP: `ip`:`port`" for Java, or the IP and port on separate lines for Bedrock. */
  private formattedAddress(): string {
    const { ip, port, edition } = this.config.server
    if (edition === 'bedrock') return `IP: \`${ip}\`\nPort: \`${port}\``
    return `IP: \`${ip}\`${port === 25565 ? '' : `:\`${port}\``}`
  }

  // Player count, followed by the names split over three columns.
  private playerFields(status: ServerStatus): APIEmbedField[] {
    const { online, max, list } = status.players
    const fields: APIEmbedField[] = [
      { name: ServerText.players.title, value: fill(ServerText.players.description, { online, max }) },
    ]
    if (this.config.server.edition === 'bedrock' || !list.length) return fields

    const columns: string[][] = Array.from({ length: PLAYER_COLUMNS }, () => [])
    list.forEach((player, index) => columns[index % PLAYER_COLUMNS]?.push(player.name))
    for (const [first, ...rest] of columns) {
      if (!first) continue
      fields.push(
        rest.length
          ? { name: `• ${first}`, value: `**• ${rest.join('\n• ')}**`, inline: true }
          : { name: ` • ${first}`, value: BLANK, inline: true }
      )
    }
    return fields
  }

  private basicEmbed(): EmbedBuilder {
    return this.serverEmbed(this.config.colors.basic)
  }

  private serverEmbed(color: BotConfig['colors']['online']): EmbedBuilder {
    const { name, icon } = this.config.server
    return new EmbedBuilder().setColor(color).setThumbnail(icon).setAuthor({ name })
  }
}
