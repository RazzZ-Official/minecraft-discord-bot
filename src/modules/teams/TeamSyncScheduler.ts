import type { Client } from 'discord.js'
import { IntervalTask } from '../../core/IntervalTask.js'
import type { Logger } from '../../core/Logger.js'
import type { AuditLog } from '../../services/AuditLog.js'
import type { MinecraftStatusService } from '../../services/MinecraftStatusService.js'
import type { TeamService } from './TeamService.js'

const CHECK_INTERVAL_MS = 60_000

/**
 * Resyncs the in-game teams at the configured hours (eg. 0, 6, 12 and 18), when the bot starts, and whenever the
 * server comes back online. Checks once a minute.
 */
export class TeamSyncScheduler {
  private task: IntervalTask | undefined
  private lastSlot: string | null = null
  private wasOnline = false

  constructor(
    private readonly service: TeamService,
    private readonly minecraft: MinecraftStatusService,
    private readonly audit: AuditLog,
    private readonly syncHours: readonly number[],
    private readonly logger: Logger
  ) {}

  start(client: Client<true>): void {
    this.task = new IntervalTask('Team resync check', CHECK_INTERVAL_MS, () => this.check(client), this.logger)
    this.task.start()
  }

  stop(): void {
    this.task?.stop()
  }

  private async check(client: Client<true>): Promise<void> {
    const online = (await this.minecraft.getStatus().catch(() => null))?.online ?? false
    const cameOnline = online && !this.wasOnline
    this.wasOnline = online
    if (!online) return

    const now = new Date()
    const slot = this.syncHours.includes(now.getHours()) ? `${now.toDateString()} ${now.getHours()}` : null
    const scheduled = slot !== null && slot !== this.lastSlot
    if (slot) this.lastSlot = slot
    // The first check after startup counts as "came online", so the bot also resyncs when it starts.
    if (!cameOnline && !scheduled) return

    const report = await this.service.resync()
    const changes = report.joined.length + report.left.length + report.removedTeams.length
    this.logger.info(`Team resync: ${report.teams} teams, ${changes} changes.`)
    if (!changes) return
    await this.audit.record(client, {
      actor: client.user,
      action: '🔄 Teams resynced',
      summary: `resynced the in-game teams (${changes} changes).`,
      fields: [
        ...(report.joined.length ? [{ name: 'Added in game', value: report.joined.join('\n').slice(0, 1024) }] : []),
        ...(report.left.length ? [{ name: 'Removed in game', value: report.left.join('\n').slice(0, 1024) }] : []),
        ...(report.removedTeams.length ? [{ name: 'Old teams deleted', value: report.removedTeams.join(', ') }] : []),
      ],
      color: 'Grey',
    })
  }
}
