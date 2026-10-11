import { EmbedBuilder } from 'discord.js'
import type { BaseMessageOptions } from 'discord.js'
import type { BotConfig } from '../../config/types.js'
import type { ServerAddress, ServerStatus } from '../../services/MinecraftStatusService.js'
import { Banner } from '../../shared/Banner.js'
import { editionName, fill, formatAddress, formatDuration, singleLine } from '../../shared/format.js'
import type { Mention } from '../../shared/Mention.js'
import { isFloodgatePlayer } from '../whitelist/PlayerName.js'

const Text = {
  onlineTitle: '⚡ {name} is Online!',
  offlineTitle: '🔴 {name} is Offline',
  onlineDescription: '**MOTD:** {motd}\n**IP:** `{ip}`\n**Version:** {version}',
  offlineDescription: '**IP:** `{ip}`\nThe server is currently unreachable.',
  edition: '🧱 Edition',
  ping: '📡 Ping',
  uptime: '⏱️ Uptime',
  playerSlots: '📊 Player Slots',
  onlinePlayers: '🧍 Online Players',
  tablePlayer: 'Player Name',
  tablePlatform: 'Platform',
  noPlayers: 'No players online right now.',
  playersHidden: 'The server does not share its player list.',
  morePlayers: '...and {count} more',
  notAvailable: 'N/A',
} as const

const PLAYER_BAR_SEGMENTS = 10
// Keeps the player table well within the 1024 character limit of an embed field.
const PLAYER_TABLE_MAX_ROWS = 15

export interface StatusCardData {
  name: string
  address: ServerAddress
  status: ServerStatus
  /** Milliseconds measured from the bot, or null when unknown. */
  ping: number | null
  /** Milliseconds from the panel, or null when unknown. */
  uptime: number | null
}

/** The live status message: title, MOTD, edition, ping, uptime, a player bar and a table of online players. */
export class StatusCardView {
  private readonly banner: Banner

  constructor(private readonly config: BotConfig) {
    this.banner = new Banner(config.statusCard.banner)
  }

  /**
   * @param attachedFileNames Files already on the message being edited, so the banner is only uploaded once.
   * @param mention Shown above the card. Edits never ping, so this only keeps it visible.
   */
  render(card: StatusCardData, mention: Mention, attachedFileNames: readonly string[] = []): BaseMessageOptions {
    const { ip, port, edition } = card.address
    const address = formatAddress(ip, port, edition)
    // The configured logo belongs to the main server; other servers show their own icon.
    const thumbnail =
      ip === this.config.server.ip ? this.config.server.icon : `https://api.mcstatus.io/v2/icon/${ip}:${port}`
    const embed = new EmbedBuilder().setAuthor({ name: card.name }).setThumbnail(thumbnail).setTimestamp()

    if (card.status.online) this.fillOnline(embed, card, address)
    else {
      embed
        .setColor(this.config.colors.offline)
        .setTitle(fill(Text.offlineTitle, { name: card.name }))
        .setDescription(fill(Text.offlineDescription, { ip: address }))
    }

    const banner = this.banner.resolve(attachedFileNames)
    if (banner.imageUrl) embed.setImage(banner.imageUrl)
    return { content: mention.text, embeds: [embed], files: banner.files, allowedMentions: mention.allowedMentions }
  }

  private fillOnline(embed: EmbedBuilder, card: StatusCardData, address: string): void {
    const { status } = card
    embed
      .setColor(this.config.colors.online)
      .setTitle(fill(Text.onlineTitle, { name: card.name }))
      .setDescription(
        fill(Text.onlineDescription, {
          motd: singleLine(status.motd) || Text.notAvailable,
          ip: address,
          version: status.version ?? Text.notAvailable,
        })
      )
      .addFields(
        { name: Text.edition, value: editionName(card.address.edition), inline: true },
        { name: Text.ping, value: card.ping === null ? Text.notAvailable : `${card.ping}ms`, inline: true },
        {
          name: Text.uptime,
          value: card.uptime === null ? Text.notAvailable : formatDuration(card.uptime),
          inline: true,
        },
        { name: Text.playerSlots, value: this.playerBar(status.players.online, status.players.max) },
        { name: Text.onlinePlayers, value: this.playerTable(card) }
      )
  }

  /** eg. 🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜ (3/20). At least one segment is filled while anyone is online. */
  private playerBar(online: number, max: number): string {
    const ratio = max > 0 ? online / max : 0
    const filled = online > 0 ? Math.min(PLAYER_BAR_SEGMENTS, Math.max(1, Math.round(ratio * PLAYER_BAR_SEGMENTS))) : 0
    return `${'🟩'.repeat(filled)}${'⬜'.repeat(PLAYER_BAR_SEGMENTS - filled)} (${online}/${max})`
  }

  private playerTable({ status, address }: StatusCardData): string {
    if (!status.players.online) return Text.noPlayers
    if (!status.players.list.length) return Text.playersHidden

    const rows = status.players.list.slice(0, PLAYER_TABLE_MAX_ROWS).map((player, index) => {
      const isBedrock = address.edition === 'bedrock' || isFloodgatePlayer(player)
      return [String(index + 1), player.name, isBedrock ? 'Bedrock' : 'Java']
    })
    const header = ['#', Text.tablePlayer, Text.tablePlatform]
    const widths = header.map((_, column) => Math.max(...[header, ...rows].map((row) => row[column]?.length ?? 0)))
    const formatRow = (row: string[]): string =>
      row
        .map((cell, column) => cell.padEnd(widths[column] ?? 0))
        .join('  ')
        .trimEnd()
    const lines = [formatRow(header), formatRow(widths.map((width) => '-'.repeat(width))), ...rows.map(formatRow)]

    const hidden = status.players.online - rows.length
    const more = hidden > 0 ? `\n${fill(Text.morePlayers, { count: hidden })}` : ''
    return `\`\`\`\n${lines.join('\n')}\n\`\`\`${more}`
  }
}
