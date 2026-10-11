import type { Client, Guild, User } from 'discord.js'
import type { TeamsConfig } from '../../config/types.js'
import type { Logger } from '../../core/Logger.js'
import type { AccountLinks } from '../../services/AccountLinks.js'
import type { AuditLog, AuditEntry } from '../../services/AuditLog.js'
import type { Nicknames } from '../../services/Nicknames.js'
import { TeamText as Text } from './messages.js'
import type { Team, TeamInvite } from './Team.js'
import type { TeamDiscord } from './TeamDiscord.js'
import type { SyncReport, TeamGameSync } from './TeamGameSync.js'
import { TeamNames } from './TeamNames.js'
import type { MinecraftColor } from './TeamNames.js'
import { isExpired } from './TeamRepository.js'
import type { TeamInviteRepository, TeamRepository, TeamSettingsRepository } from './TeamRepository.js'
import type { TeamViews } from './TeamViews.js'

/** Why an action was refused: a message from TeamText.replies with its placeholder values. */
export interface TeamProblem {
  key: keyof typeof Text.replies
  values?: Record<string, string>
}

export type TeamResult<T> = { ok: true; value: T } | { ok: false; problem: TeamProblem }

const ok = <T>(value: T): TeamResult<T> => ({ ok: true, value })
const fail = <T>(key: TeamProblem['key'], values?: Record<string, string>): TeamResult<T> => ({
  ok: false,
  problem: values ? { key, values } : { key },
})

export interface NewTeam {
  name: string
  tag: string
  color: MinecraftColor
  leader: User
}

/** Team rules. Discord replies are left to the handlers; every change is recorded in the audit log. */
export class TeamService {
  constructor(
    private readonly config: TeamsConfig,
    private readonly teams: TeamRepository,
    private readonly invites: TeamInviteRepository,
    private readonly settings: TeamSettingsRepository,
    private readonly discord: TeamDiscord,
    private readonly game: TeamGameSync,
    private readonly views: TeamViews,
    private readonly links: AccountLinks,
    private readonly nicknames: Nicknames,
    private readonly audit: AuditLog,
    private readonly logger: Logger
  ) {}

  get locked(): boolean {
    return this.settings.get().locked
  }

  teamOf(userId: string): Team | null {
    return this.teams.findByMember(userId)
  }

  find(tagOrName: string): Team | null {
    return this.teams.find(tagOrName)
  }

  all(): readonly Team[] {
    return this.teams.all()
  }

  // --- MC Admin ---------------------------------------------------------------------------------------------------

  async create(guild: Guild, admin: User, input: NewTeam): Promise<TeamResult<Team>> {
    const name = input.name.trim()
    const tag = TeamNames.normalizeTag(input.tag)
    if (!TeamNames.isValidName(name)) return fail('invalidName')
    if (!TeamNames.isValidTag(tag)) return fail('invalidTag')
    if (this.teams.isTaken(tag, name)) return fail('taken')
    const joinProblem = this.joinProblem(input.leader)
    if (joinProblem) return { ok: false, problem: joinProblem }

    const channels = await this.discord.create(guild, { name, tag, color: input.color }, input.leader.id)
    const team = await this.teams.create({
      teamId: TeamNames.teamId(tag),
      name,
      tag,
      color: input.color,
      guildId: guild.id,
      leaderId: input.leader.id,
      memberIds: [input.leader.id],
      ...channels,
      base: null,
      createdBy: admin.id,
      createdAt: new Date().toISOString(),
    })
    await this.discord.addMember(guild, team, input.leader.id)
    await this.nicknames.update(guild, input.leader.id)
    await this.discord.sendToChat(guild, team, this.views.welcome(team))
    await this.game.applyTeam(team)
    await this.record(guild.client, admin, `🛡️ Team created`, `created team [${tag}] ${name}.`, team, [
      { name: 'Leader', value: `<@${input.leader.id}>`, inline: true },
    ])
    return ok(team)
  }

  async delete(guild: Guild, admin: User, team: Team): Promise<void> {
    await this.teams.delete(team.teamId)
    await this.invites.deleteForTeam(team.teamId)
    await this.discord.delete(guild, team)
    await this.game.removeTeam(team)
    for (const userId of team.memberIds) await this.nicknames.update(guild, userId)
    await this.record(guild.client, admin, '🗑️ Team deleted', `deleted team [${team.tag}] ${team.name}.`, team)
  }

  async rename(guild: Guild, admin: User, team: Team, newName: string): Promise<TeamResult<Team>> {
    const name = newName.trim()
    if (!TeamNames.isValidName(name)) return fail('invalidName')
    if (
      this.teams.all().some((other) => other.teamId !== team.teamId && other.name.toLowerCase() === name.toLowerCase())
    ) {
      return fail('taken')
    }
    await this.discord.rename(guild, team, name)
    const updated = (await this.teams.update(team.teamId, { name })) ?? team
    await this.game.applyTeam(updated)
    await this.record(guild.client, admin, '✏️ Team renamed', `renamed [${team.tag}] to ${name}.`, updated, [
      { name: 'Old name', value: team.name, inline: true },
    ])
    return ok(updated)
  }

  async recolor(guild: Guild, admin: User, team: Team, color: MinecraftColor): Promise<Team> {
    await this.discord.recolor(guild, team, color)
    const updated = (await this.teams.update(team.teamId, { color })) ?? team
    await this.game.applyTeam(updated)
    await this.record(guild.client, admin, '🎨 Team colour changed', `set [${team.tag}] to ${color}.`, updated)
    return updated
  }

  /** Adds a player directly, without an invite. Works while teams are locked. */
  async addMember(guild: Guild, admin: User, team: Team, user: User): Promise<TeamResult<Team>> {
    const problem = this.joinProblem(user)
    if (problem) return { ok: false, problem }
    const updated = await this.join(guild, team, user.id)
    await this.record(guild.client, admin, '➕ Member added', `added ${user.tag} to [${team.tag}].`, updated, [
      { name: 'Player', value: `<@${user.id}>`, inline: true },
    ])
    return ok(updated)
  }

  /** Removes a player from their team. The leader can only be removed by deleting the team or changing the leader. */
  async removeMember(guild: Guild, admin: User, user: User): Promise<TeamResult<Team>> {
    const team = this.teams.findByMember(user.id)
    if (!team) return fail('notMember', { user: `<@${user.id}>` })
    if (team.leaderId === user.id) return fail('leaderLeave')
    const updated = await this.leaveTeam(guild, team, user.id)
    await this.record(guild.client, admin, '➖ Member removed', `removed ${user.tag} from [${team.tag}].`, updated, [
      { name: 'Player', value: `<@${user.id}>`, inline: true },
    ])
    return ok(updated)
  }

  async setLeader(guild: Guild, actor: User, team: Team, user: User): Promise<TeamResult<Team>> {
    if (!team.memberIds.includes(user.id)) return fail('notMember', { user: `<@${user.id}>` })
    if (team.leaderId === user.id) return fail('cannotTargetSelf')
    await this.discord.changeLeader(guild, team, user.id)
    const updated = (await this.teams.update(team.teamId, { leaderId: user.id })) ?? team
    await this.discord.sendToChat(guild, updated, this.views.notice(Text.embeds.newLeader, user.id))
    await this.record(
      guild.client,
      actor,
      '👑 Leader changed',
      `made ${user.tag} the leader of [${team.tag}].`,
      updated,
      [{ name: 'New leader', value: `<@${user.id}>`, inline: true }]
    )
    return ok(updated)
  }

  async setLocked(client: Client, admin: User, locked: boolean): Promise<void> {
    await this.settings.setLocked(locked)
    await this.audit.record(client, {
      actor: admin,
      action: locked ? '🔒 Teams locked' : '🔓 Teams unlocked',
      summary: locked ? 'locked all teams.' : 'unlocked all teams.',
      color: locked ? 'Orange' : 'Green',
    })
  }

  async resync(): Promise<SyncReport> {
    await this.invites.deleteExpired()
    return this.game.resync(this.teams.all())
  }

  // --- Leaders ----------------------------------------------------------------------------------------------------

  /** Creates an invite. The handler delivers it by DM. */
  async invite(leader: User, user: User): Promise<TeamResult<{ team: Team; invite: TeamInvite }>> {
    if (this.locked) return fail('locked')
    const team = this.teams.findByMember(leader.id)
    if (!team) return fail('notInTeam')
    if (team.leaderId !== leader.id) return fail('notLeader')
    const problem = this.joinProblem(user)
    if (problem) return { ok: false, problem }
    if (this.invites.findPending(team.teamId, user.id)) return fail('inviteAlreadySent', { user: `<@${user.id}>` })
    const invite = await this.invites.create(team.teamId, user.id, leader.id, this.config.inviteExpiryHours)
    return ok({ team, invite })
  }

  /** Removes an invite that could not be delivered. */
  async cancelInvite(inviteId: string): Promise<void> {
    await this.invites.delete(inviteId)
  }

  async kick(guild: Guild, leader: User, user: User): Promise<TeamResult<Team>> {
    const team = this.leaderTeam(leader)
    if (!team.ok) return team
    if (user.id === leader.id) return fail('cannotTargetSelf')
    if (!team.value.memberIds.includes(user.id)) return fail('notMember', { user: `<@${user.id}>` })
    const updated = await this.leaveTeam(guild, team.value, user.id)
    await this.record(
      guild.client,
      leader,
      '👢 Member kicked',
      `kicked ${user.tag} from [${team.value.tag}].`,
      updated,
      [{ name: 'Player', value: `<@${user.id}>`, inline: true }]
    )
    return ok(updated)
  }

  async transfer(guild: Guild, leader: User, user: User): Promise<TeamResult<Team>> {
    const team = this.leaderTeam(leader)
    if (!team.ok) return team
    return this.setLeader(guild, leader, team.value, user)
  }

  async setBase(
    guild: Guild,
    leader: User,
    coordinates: { x: number; y: number; z: number; note: string | null }
  ): Promise<TeamResult<Team>> {
    const team = this.leaderTeam(leader, { allowWhileLocked: true })
    if (!team.ok) return team
    const withBase: Team = { ...team.value, base: { ...coordinates, messageId: team.value.base?.messageId ?? null } }
    const messageId = await this.discord.upsertPinned(
      guild,
      withBase,
      withBase.base?.messageId ?? null,
      this.views.base(withBase)
    )
    const updated = (await this.teams.update(team.value.teamId, { base: { ...coordinates, messageId } })) ?? withBase
    await this.record(guild.client, leader, '📍 Team base set', `set the base of [${team.value.tag}].`, updated, [
      { name: 'Coordinates', value: `\`${coordinates.x} ${coordinates.y} ${coordinates.z}\``, inline: true },
    ])
    return ok(updated)
  }

  async announce(guild: Guild, leader: User, message: string): Promise<TeamResult<Team>> {
    const team = this.leaderTeam(leader, { allowWhileLocked: true })
    if (!team.ok) return team
    await this.discord.sendToChat(guild, team.value, this.views.announcement(team.value, leader, message))
    return ok(team.value)
  }

  // --- Members ----------------------------------------------------------------------------------------------------

  async acceptInvite(client: Client, user: User, inviteId: string): Promise<TeamResult<Team>> {
    const invite = this.invites.find(inviteId)
    if (!invite || isExpired(invite)) return fail('inviteNotFound')
    if (invite.userId !== user.id) return fail('inviteNotYours')
    if (this.locked) return fail('locked')
    const team = this.teams.findById(invite.teamId)
    if (!team) return fail('inviteNotFound')
    const problem = this.joinProblem(user)
    if (problem) return { ok: false, problem }

    const guild = await client.guilds.fetch(team.guildId)
    const updated = await this.join(guild, team, user.id)
    await this.invites.deleteForUser(user.id)
    await this.record(client, user, '✅ Joined team', `joined [${team.tag}] by invite.`, updated, [
      { name: 'Invited by', value: `<@${invite.invitedBy}>`, inline: true },
    ])
    return ok(updated)
  }

  async declineInvite(client: Client, user: User, inviteId: string): Promise<TeamResult<Team | null>> {
    const invite = this.invites.find(inviteId)
    if (!invite) return fail('inviteNotFound')
    if (invite.userId !== user.id) return fail('inviteNotYours')
    await this.invites.delete(inviteId)
    const team = this.teams.findById(invite.teamId)
    if (team) await this.record(client, user, '❌ Invite declined', `declined the invite to [${team.tag}].`, team)
    return ok(team)
  }

  async leave(guild: Guild, user: User): Promise<TeamResult<Team>> {
    if (this.locked) return fail('locked')
    const team = this.teams.findByMember(user.id)
    if (!team) return fail('notInTeam')
    if (team.leaderId === user.id) return fail('leaderLeave')
    const updated = await this.leaveTeam(guild, team, user.id)
    await this.record(guild.client, user, '🚪 Left team', `left [${team.tag}].`, updated)
    return ok(updated)
  }

  // --- Shared steps -----------------------------------------------------------------------------------------------

  // Players must be real, linked to a Minecraft account (approved whitelist), and not in a team already.
  private joinProblem(user: User): TeamProblem | null {
    if (user.bot) return { key: 'isBot' }
    if (!this.links.get(user.id)) return { key: 'notLinked', values: { user: `<@${user.id}>` } }
    if (this.teams.findByMember(user.id)) return { key: 'alreadyInTeam', values: { user: `<@${user.id}>` } }
    return null
  }

  private leaderTeam(leader: User, options: { allowWhileLocked?: boolean } = {}): TeamResult<Team> {
    if (this.locked && !options.allowWhileLocked) return fail('locked')
    const team = this.teams.findByMember(leader.id)
    if (!team) return fail('notInTeam')
    if (team.leaderId !== leader.id) return fail('notLeader')
    return ok(team)
  }

  private async join(guild: Guild, team: Team, userId: string): Promise<Team> {
    const updated = (await this.teams.update(team.teamId, { memberIds: [...team.memberIds, userId] })) ?? team
    await this.discord.addMember(guild, updated, userId)
    await this.nicknames.update(guild, userId)
    await this.game.addPlayer(updated, userId)
    await this.discord.sendToChat(guild, updated, this.views.notice(Text.embeds.joined, userId))
    return updated
  }

  private async leaveTeam(guild: Guild, team: Team, userId: string): Promise<Team> {
    const updated =
      (await this.teams.update(team.teamId, { memberIds: team.memberIds.filter((id) => id !== userId) })) ?? team
    await this.discord.removeMember(guild, team, userId)
    await this.nicknames.update(guild, userId)
    await this.game.removePlayer(userId)
    await this.discord.sendToChat(guild, updated, this.views.notice(Text.embeds.leftTeam, userId))
    return updated
  }

  private async record(
    client: Client,
    actor: User,
    action: string,
    summary: string,
    team: Team,
    fields: AuditEntry['fields'] = []
  ): Promise<void> {
    await this.audit.record(client, {
      actor,
      action,
      summary,
      fields: [{ name: 'Team', value: `[${team.tag}] ${team.name}`, inline: true }, ...(fields ?? [])],
      color: 'Blurple',
    })
    this.logger.debug(`${actor.tag} ${summary}`)
  }
}
