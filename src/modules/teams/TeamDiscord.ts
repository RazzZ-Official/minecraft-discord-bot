import { ChannelType, OverwriteType, PermissionFlagsBits } from 'discord.js'
import type { BaseMessageOptions, Guild, OverwriteResolvable } from 'discord.js'
import type { TeamsConfig } from '../../config/types.js'
import type { Team } from './Team.js'
import { MINECRAFT_COLORS, TeamNames } from './TeamNames.js'
import type { MinecraftColor } from './TeamNames.js'

const P = PermissionFlagsBits
const MEMBER_PERMISSIONS = [
  P.ViewChannel,
  P.ReadMessageHistory,
  P.SendMessages,
  P.SendMessagesInThreads,
  P.CreatePublicThreads,
  P.AttachFiles,
  P.EmbedLinks,
  P.AddReactions,
  P.UseExternalEmojis,
  P.UseApplicationCommands,
  P.Connect,
  P.Speak,
  P.Stream,
  P.UseVAD,
]
const MODERATOR_PERMISSIONS = [P.ViewChannel, P.ReadMessageHistory, P.Connect, P.ManageMessages, P.MoveMembers]
// Leaders can pin and remove messages in their own team's channels.
const LEADER_PERMISSIONS = [P.ManageMessages]

export type TeamChannels = Pick<Team, 'roleId' | 'categoryId' | 'chatChannelId' | 'galleryChannelId' | 'voiceChannelId'>

/** Creates and maintains a team's role and private channels. */
export class TeamDiscord {
  constructor(private readonly config: TeamsConfig) {}

  async create(
    guild: Guild,
    team: { name: string; tag: string; color: MinecraftColor },
    leaderId: string
  ): Promise<TeamChannels> {
    const role = await guild.roles.create({
      name: TeamNames.roleName(team.tag, team.name),
      colors: { primaryColor: MINECRAFT_COLORS[team.color] },
      hoist: true,
      mentionable: false,
      permissions: [],
      reason: `Team ${team.tag} created`,
    })
    const anchor = guild.roles.cache.get(this.config.placeRolesAboveRoleId)
    if (anchor) await role.setPosition(anchor.position + 1).catch(() => undefined)

    const overwrites = this.overwrites(guild, role.id, leaderId)
    const names = TeamNames.channelNames(team.tag, team.name)
    const category = await guild.channels.create({
      name: names.category,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
    })
    const create = (name: string, type: ChannelType.GuildText | ChannelType.GuildVoice) =>
      guild.channels.create({ name, type, parent: category.id, permissionOverwrites: overwrites })
    const chat = await create(names.chat, ChannelType.GuildText)
    const gallery = await create(names.gallery, ChannelType.GuildText)
    const voice = await create(names.voice, ChannelType.GuildVoice)

    return {
      roleId: role.id,
      categoryId: category.id,
      chatChannelId: chat.id,
      galleryChannelId: gallery.id,
      voiceChannelId: voice.id,
    }
  }

  /** Removes the team's channels and role. Already-missing ones are skipped. */
  async delete(guild: Guild, team: Team): Promise<void> {
    for (const channelId of [team.chatChannelId, team.galleryChannelId, team.voiceChannelId, team.categoryId]) {
      await guild.channels.delete(channelId, `Team ${team.tag} deleted`).catch(() => undefined)
    }
    await guild.roles.delete(team.roleId, `Team ${team.tag} deleted`).catch(() => undefined)
  }

  async rename(guild: Guild, team: Team, name: string): Promise<void> {
    await guild.roles.edit(team.roleId, { name: TeamNames.roleName(team.tag, name) })
    await guild.channels.edit(team.categoryId, { name: TeamNames.channelNames(team.tag, name).category })
  }

  async recolor(guild: Guild, team: Team, color: MinecraftColor): Promise<void> {
    await guild.roles.edit(team.roleId, { colors: { primaryColor: MINECRAFT_COLORS[color] } })
  }

  /** Moves the leader's extra permissions from the old leader to the new one. */
  async changeLeader(guild: Guild, team: Team, newLeaderId: string): Promise<void> {
    for (const channelId of [team.categoryId, team.chatChannelId, team.galleryChannelId, team.voiceChannelId]) {
      const channel = await guild.channels.fetch(channelId).catch(() => null)
      if (!channel || channel.isThread()) continue
      await channel.permissionOverwrites.delete(team.leaderId).catch(() => undefined)
      await channel.permissionOverwrites.edit(newLeaderId, { ManageMessages: true })
    }
  }

  async addMember(guild: Guild, team: Team, userId: string): Promise<void> {
    const member = await guild.members.fetch(userId)
    await member.roles.add(team.roleId, `Joined team ${team.tag}`)
  }

  async removeMember(guild: Guild, team: Team, userId: string): Promise<void> {
    const member = await guild.members.fetch(userId).catch(() => null)
    await member?.roles.remove(team.roleId, `Left team ${team.tag}`).catch(() => undefined)
  }

  /** Sends a message to the team chat. */
  async sendToChat(guild: Guild, team: Team, message: BaseMessageOptions): Promise<string | null> {
    const channel = await guild.channels.fetch(team.chatChannelId).catch(() => null)
    if (!channel?.isSendable()) return null
    return (await channel.send(message)).id
  }

  /** Posts the base message in the team chat and pins it, or edits the existing one. Returns its message ID. */
  async upsertPinned(
    guild: Guild,
    team: Team,
    messageId: string | null,
    message: BaseMessageOptions
  ): Promise<string | null> {
    const channel = await guild.channels.fetch(team.chatChannelId).catch(() => null)
    if (!channel?.isTextBased()) return null
    const existing = messageId ? await channel.messages.fetch(messageId).catch(() => null) : null
    if (existing) {
      await existing.edit(message)
      return existing.id
    }
    const sent = await channel.send(message)
    await sent.pin().catch(() => undefined)
    return sent.id
  }

  private overwrites(guild: Guild, roleId: string, leaderId: string): OverwriteResolvable[] {
    return [
      { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [P.ViewChannel] },
      { id: roleId, type: OverwriteType.Role, allow: MEMBER_PERMISSIONS },
      ...this.config.moderatorRoleIds.map((id) => ({ id, type: OverwriteType.Role, allow: MODERATOR_PERMISSIONS })),
      { id: leaderId, type: OverwriteType.Member, allow: LEADER_PERMISSIONS },
    ]
  }
}
