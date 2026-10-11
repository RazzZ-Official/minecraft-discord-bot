import crypto from 'node:crypto'
import { JsonStore } from '../../core/JsonStore.js'
import type { Team, TeamInvite } from './Team.js'

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** Teams in datas/teams.json. */
export class TeamRepository {
  private readonly store = new JsonStore<Team>('teams')

  all(): readonly Team[] {
    return this.store.all()
  }

  findById(teamId: string): Team | null {
    return this.store.find((team) => team.teamId === teamId) ?? null
  }

  /** Finds a team by its tag or its name. */
  find(tagOrName: string): Team | null {
    const query = tagOrName.trim().replace(/^\[|\]$/g, '')
    return this.store.find((team) => same(team.tag, query) || same(team.name, query)) ?? null
  }

  findByMember(userId: string): Team | null {
    return this.store.find((team) => team.memberIds.includes(userId)) ?? null
  }

  findByGallery(channelId: string): Team | null {
    return this.store.find((team) => team.galleryChannelId === channelId) ?? null
  }

  isTaken(tag: string, name: string): boolean {
    return this.store.all().some((team) => same(team.tag, tag) || same(team.name, name))
  }

  create(team: Team): Promise<Team> {
    return this.store.insert(team)
  }

  async update(teamId: string, changes: Partial<Team>): Promise<Team | null> {
    return (await this.store.update((team) => team.teamId === teamId, changes)) ?? null
  }

  async delete(teamId: string): Promise<void> {
    await this.store.remove((team) => team.teamId === teamId)
  }
}

/** Pending invites in datas/team-invites.json. */
export class TeamInviteRepository {
  private readonly store = new JsonStore<TeamInvite>('team-invites')

  find(inviteId: string): TeamInvite | null {
    return this.store.find((invite) => invite.inviteId === inviteId) ?? null
  }

  findPending(teamId: string, userId: string): TeamInvite | null {
    return (
      this.store.find((invite) => invite.teamId === teamId && invite.userId === userId && !isExpired(invite)) ?? null
    )
  }

  create(teamId: string, userId: string, invitedBy: string, expiryHours: number): Promise<TeamInvite> {
    const now = Date.now()
    return this.store.insert({
      inviteId: crypto.randomBytes(6).toString('hex'),
      teamId,
      userId,
      invitedBy,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + expiryHours * 3_600_000).toISOString(),
    })
  }

  async delete(inviteId: string): Promise<void> {
    await this.store.remove((invite) => invite.inviteId === inviteId)
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.store.remove((invite) => invite.userId === userId)
  }

  async deleteForTeam(teamId: string): Promise<void> {
    await this.store.remove((invite) => invite.teamId === teamId)
  }

  async deleteExpired(): Promise<void> {
    await this.store.remove(isExpired)
  }
}

export const isExpired = (invite: TeamInvite): boolean => new Date(invite.expiresAt).getTime() <= Date.now()

interface TeamSettings {
  /** While locked, players cannot create, join, leave or change teams. MC Admins still can. */
  locked: boolean
  /** In-game teams the bot created, so the resync can remove ones whose team was deleted. */
  gameTeamIds: string[]
}

/** Team-wide settings in datas/team-settings.json (a single record). */
export class TeamSettingsRepository {
  private readonly store = new JsonStore<TeamSettings>('team-settings')

  get(): TeamSettings {
    return this.store.all()[0] ?? { locked: false, gameTeamIds: [] }
  }

  async setLocked(locked: boolean): Promise<void> {
    await this.save({ ...this.get(), locked })
  }

  async setGameTeamIds(gameTeamIds: string[]): Promise<void> {
    await this.save({ ...this.get(), gameTeamIds: [...new Set(gameTeamIds)] })
  }

  private async save(settings: TeamSettings): Promise<void> {
    await this.store.upsert(() => true, settings)
  }
}
