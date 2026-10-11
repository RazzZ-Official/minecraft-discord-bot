import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, time, TimestampStyles } from 'discord.js'
import type { BaseMessageOptions, User } from 'discord.js'
import type { ServerConfig } from '../../config/types.js'
import { CustomId } from '../../core/CustomId.js'
import type { AccountLinks } from '../../services/AccountLinks.js'
import { fill } from '../../shared/format.js'
import { TeamIds, TeamText } from './messages.js'
import type { Team, TeamInvite } from './Team.js'
import { MINECRAFT_COLORS } from './TeamNames.js'

const text = TeamText.embeds

export class TeamViews {
  constructor(
    private readonly server: ServerConfig,
    private readonly links: AccountLinks
  ) {}

  /** The DM a player receives with Accept and Decline buttons. */
  inviteDm(team: Team, invite: TeamInvite, inviter: User): BaseMessageOptions {
    const embed = this.teamEmbed(team)
      .setTitle(text.inviteTitle)
      .setDescription(
        fill(text.inviteBody, {
          inviter: `<@${inviter.id}>`,
          tag: team.tag,
          name: team.name,
          server: this.server.name,
          expires: time(new Date(invite.expiresAt), TimestampStyles.RelativeTime),
        })
      )
      .addFields(this.memberField(team))
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CustomId.build(TeamIds.accept, invite.inviteId))
        .setLabel(text.accept)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(CustomId.build(TeamIds.decline, invite.inviteId))
        .setLabel(text.decline)
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary)
    )
    return { embeds: [embed], components: [buttons] }
  }

  /** Replaces the invite DM once it was answered. */
  inviteAnswered(content: string): BaseMessageOptions {
    return { content, embeds: [], components: [] }
  }

  info(team: Team): EmbedBuilder {
    return this.teamEmbed(team)
      .setTitle(`[${team.tag}] ${team.name}`)
      .addFields(
        { name: text.leader, value: this.memberLabel(team.leaderId), inline: true },
        { name: text.base, value: this.baseText(team) ?? text.noBaseShort, inline: true },
        this.memberField(team)
      )
  }

  list(teams: readonly Team[]): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('Blurple')
      .setAuthor({ name: this.server.name, iconURL: this.server.icon })
      .setTitle(fill(text.listTitle, { count: teams.length }))
      .setDescription(
        teams
          .map((team) => `**[${team.tag}] ${team.name}**: ${team.memberIds.length} members, led by <@${team.leaderId}>`)
          .join('\n')
      )
  }

  welcome(team: Team): BaseMessageOptions {
    return {
      content: `<@&${team.roleId}>`,
      embeds: [
        this.teamEmbed(team).setDescription(
          fill(text.welcome, { tag: team.tag, name: team.name, leader: `<@${team.leaderId}>` })
        ),
      ],
      allowedMentions: { roles: [team.roleId] },
    }
  }

  base(team: Team): BaseMessageOptions {
    return {
      embeds: [
        this.teamEmbed(team)
          .setTitle(text.baseTitle)
          .setDescription(this.baseText(team) ?? text.noBaseShort),
      ],
    }
  }

  announcement(team: Team, leader: User, message: string): BaseMessageOptions {
    const embed = this.teamEmbed(team)
      .setAuthor({ name: `${leader.displayName} • Team Leader`, iconURL: leader.displayAvatarURL() })
      .setTitle('📢 Announcement')
      .setDescription(message)
      .setTimestamp()
    return { content: `<@&${team.roleId}>`, embeds: [embed], allowedMentions: { roles: [team.roleId] } }
  }

  /** A short note in the team chat, eg. "👋 Steve joined the team!". */
  notice(template: string, userId: string): BaseMessageOptions {
    return { content: fill(template, { user: `<@${userId}>` }), allowedMentions: { parse: [] } }
  }

  private teamEmbed(team: Team): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(MINECRAFT_COLORS[team.color])
      .setAuthor({ name: this.server.name, iconURL: this.server.icon })
  }

  private memberField(team: Team): { name: string; value: string } {
    return {
      name: fill(text.members, { count: team.memberIds.length }),
      value: team.memberIds.map((userId) => `• ${this.memberLabel(userId)}`).join('\n') || '-',
    }
  }

  // "@user (Steve)", with the linked Minecraft name when there is one.
  private memberLabel(userId: string): string {
    const name = this.links.get(userId)?.minecraftName
    return name ? `<@${userId}> (\`${name}\`)` : `<@${userId}>`
  }

  private baseText(team: Team): string | null {
    if (!team.base) return null
    const { x, y, z, note } = team.base
    return `\`${x} ${y} ${z}\`${note ? `\n${note}` : ''}`
  }
}
