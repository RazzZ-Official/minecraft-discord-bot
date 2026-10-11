import type { Logger } from '../../core/Logger.js'
import type { AccountLinks } from '../../services/AccountLinks.js'
import type { PanelClient } from '../../services/PanelClient.js'
import type { PanelConsole } from '../../services/PanelConsole.js'
import type { Team } from './Team.js'
import { TeamNames } from './TeamNames.js'
import type { TeamSettingsRepository } from './TeamRepository.js'

export interface SyncReport {
  teams: number
  joined: string[]
  left: string[]
  removedTeams: string[]
}

// "Team [Razz Warriors] has 2 member(s): Steve, .Connor_Leo2299" / "There are no members on team [Razz Warriors]"
const MEMBERS_LINE = /has \d+ member\(s\): (.+)$/
const NO_MEMBERS_LINE = /There are no members on team/

/**
 * Mirrors teams in game as vanilla scoreboard teams: coloured "[TAG]" prefix, friendly fire off. Only these fixed
 * /team commands are sent, built from validated team IDs, tags and player names.
 *
 * Changes are applied right away when the server is online. The resync compares the game with datas/teams.json and
 * fixes any difference, eg. after the server was offline during a change.
 */
export class TeamGameSync {
  constructor(
    private readonly panel: PanelClient,
    private readonly console: PanelConsole,
    private readonly links: AccountLinks,
    private readonly settings: TeamSettingsRepository,
    private readonly logger: Logger
  ) {}

  /** Creates or updates the team's look in game, and adds its linked members. */
  async applyTeam(team: Team): Promise<void> {
    await this.settings.setGameTeamIds([...this.settings.get().gameTeamIds, team.teamId])
    const commands = [
      ...this.definitionCommands(team),
      ...this.memberNames(team).map((name) => `team join ${team.teamId} ${name}`),
    ]
    try {
      await this.console.withSession(async (session) => {
        for (const command of commands) await session.send(command)
      })
    } catch (error) {
      this.logger.warn(`Could not update team ${team.tag} in game (applied at the next resync): ${errorText(error)}`)
    }
  }

  async addPlayer(team: Team, userId: string): Promise<void> {
    const name = this.playerName(userId)
    if (name) await this.send([`team join ${team.teamId} ${name}`])
  }

  async removePlayer(userId: string): Promise<void> {
    const name = this.playerName(userId)
    if (name) await this.send([`team leave ${name}`])
  }

  async removeTeam(team: Team): Promise<void> {
    await this.send([`team remove ${team.teamId}`])
    await this.settings.setGameTeamIds(this.settings.get().gameTeamIds.filter((id) => id !== team.teamId))
  }

  /**
   * Makes the game match the teams: looks, members, and removes teams that no longer exist. Everything goes through
   * one console session, so a resync costs a single panel request.
   */
  async resync(teams: readonly Team[]): Promise<SyncReport> {
    const report: SyncReport = { teams: teams.length, joined: [], left: [], removedTeams: [] }
    const activeIds = new Set(teams.map((team) => team.teamId))
    const staleIds = this.settings.get().gameTeamIds.filter((id) => !activeIds.has(id))
    if (!teams.length && !staleIds.length) return report

    await this.console.withSession(async (session) => {
      for (const command of teams.flatMap((team) => this.definitionCommands(team))) await session.send(command)
      for (const team of teams) {
        const current = this.parseMembers(await session.run(`team list ${team.teamId}`))
        const wanted = this.memberNames(team)
        const has = (names: string[], name: string): boolean =>
          names.some((other) => other.toLowerCase() === name.toLowerCase())
        for (const name of wanted.filter((name) => !has(current, name))) {
          await session.send(`team join ${team.teamId} ${name}`)
          report.joined.push(`${name} → ${team.tag}`)
        }
        for (const name of current.filter((name) => !has(wanted, name))) {
          await session.send(`team leave ${name}`)
          report.left.push(`${name} ✕ ${team.tag}`)
        }
      }
      for (const id of staleIds) await session.send(`team remove ${id}`)
    })
    report.removedTeams.push(...staleIds)
    await this.settings.setGameTeamIds([...activeIds])
    return report
  }

  private definitionCommands(team: Team): string[] {
    const id = this.teamId(team)
    // JSON text components; names and tags are validated, and JSON.stringify escapes them anyway.
    const displayName = JSON.stringify({ text: team.name })
    const prefix = JSON.stringify({ text: `[${team.tag}] `, color: team.color })
    return [
      `team add ${id} ${displayName}`,
      `team modify ${id} displayName ${displayName}`,
      `team modify ${id} color ${team.color}`,
      `team modify ${id} prefix ${prefix}`,
      `team modify ${id} friendlyFire false`,
      `team modify ${id} seeFriendlyInvisibles true`,
    ]
  }

  private teamId(team: Team): string {
    if (team.teamId !== TeamNames.teamId(team.tag)) throw new Error(`Unexpected team ID "${team.teamId}".`)
    return team.teamId
  }

  // Linked Minecraft names of the members. Members who are not linked yet are skipped until they are.
  private memberNames(team: Team): string[] {
    return team.memberIds.map((userId) => this.playerName(userId)).filter((name): name is string => name !== null)
  }

  private playerName(userId: string): string | null {
    const name = this.links.get(userId)?.minecraftName
    return name && TeamNames.isValidPlayer(name) ? name : null
  }

  private parseMembers(lines: string[]): string[] {
    if (lines.some((line) => NO_MEMBERS_LINE.test(line))) return []
    const match = lines.map((line) => MEMBERS_LINE.exec(line)).find(Boolean)
    return (match?.[1] ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => TeamNames.isValidPlayer(name))
  }

  // Sends single commands for small live changes. When the server is offline they fail, and the next resync applies
  // the change.
  private async send(commands: string[]): Promise<void> {
    for (const command of commands) {
      try {
        await this.panel.sendCommand(command)
      } catch (error) {
        this.logger.warn(`In-game team command failed (applied at the next resync): ${errorText(error)}`)
        return
      }
    }
  }
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error))
