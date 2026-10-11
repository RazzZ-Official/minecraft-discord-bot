import { ActivityType } from 'discord.js'
import type { ActivitiesOptions, Client } from 'discord.js'
import type { PresenceActivity } from '../../config/types.js'
import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import { IntervalTask } from '../../core/IntervalTask.js'
import type { Logger } from '../../core/Logger.js'
import { fill, formatDuration } from '../../shared/format.js'

// Server data is refreshed at most this often; the activities rotate faster, using the last snapshot.
const SNAPSHOT_MAX_AGE_MS = 60_000
const PLACEHOLDER = /\{(\w+)\}/g

interface Snapshot {
  online: boolean
  values: Record<string, string | number>
  takenAt: number
}

/** Rotates the bot's Discord activity through the configured list, filled in with live server data. */
export class PresenceModule extends BotModule {
  readonly name = 'presence'
  private readonly logger: Logger
  private task: IntervalTask | undefined
  private snapshot: Snapshot | undefined
  private index = 0

  constructor(private readonly context: AppContext) {
    super()
    this.logger = context.logger.child(this.name)
  }

  override get enabled(): boolean {
    return this.context.config.presence.enabled
  }

  override onReady(client: Client<true>): Promise<void> {
    const intervalMs = Math.max(15, this.context.config.presence.rotateSeconds) * 1000
    this.task = new IntervalTask('Presence update', intervalMs, () => this.rotate(client), this.logger)
    this.task.start()
    return Promise.resolve()
  }

  override onShutdown(): void {
    this.task?.stop()
  }

  private async rotate(client: Client<true>): Promise<void> {
    const { presence } = this.context.config
    const snapshot = await this.currentSnapshot()
    // Only activities whose placeholders all have a value right now.
    const candidates = (snapshot.online ? presence.online : presence.offline).filter((activity) =>
      [...activity.text.matchAll(PLACEHOLDER)].every(([, key]) => key !== undefined && key in snapshot.values)
    )
    const activity = candidates[this.index++ % Math.max(candidates.length, 1)]
    if (!activity) return

    client.user.setPresence({
      status: snapshot.online ? presence.status.online : presence.status.offline,
      activities: [this.toActivity(activity, snapshot.values)],
    })
    this.logger.debug(`Activity: ${activity.type} "${fill(activity.text, snapshot.values)}".`)
  }

  private toActivity(activity: PresenceActivity, values: Snapshot['values']): ActivitiesOptions {
    const text = fill(activity.text, values)
    // Custom activities show their state text on its own, without "Playing" or "Watching" in front.
    if (activity.type === 'Custom') return { type: ActivityType.Custom, name: text, state: text }
    return { type: ActivityType[activity.type], name: text }
  }

  private async currentSnapshot(): Promise<Snapshot> {
    if (this.snapshot && Date.now() - this.snapshot.takenAt < SNAPSHOT_MAX_AGE_MS) return this.snapshot
    const { server } = this.context.config
    const status = await this.context.minecraft.getStatus()
    const values: Snapshot['values'] = {
      name: server.name,
      // The domain alone: Java players join through its SRV record.
      ip: server.ip,
      playeronline: status.players.online,
      playermax: status.players.max,
    }
    if (status.version) values.version = status.version
    const uptime = status.online ? await this.uptime() : null
    if (uptime !== null) values.uptime = formatDuration(uptime)

    this.snapshot = { online: status.online, values, takenAt: Date.now() }
    return this.snapshot
  }

  private async uptime(): Promise<number | null> {
    try {
      return (await this.context.panel?.getServerUptime()) ?? null
    } catch (error) {
      this.logger.debug(`Uptime unavailable: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }
}
