import { ActivityType } from 'discord.js'
import type { Client } from 'discord.js'
import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import { IntervalTask } from '../../core/IntervalTask.js'
import { fill } from '../../shared/format.js'

const UPDATE_INTERVAL_MS = 60_000

/** Shows the server's player count, or that it is offline, as the bot's Discord activity. */
export class PresenceModule extends BotModule {
  readonly name = 'presence'
  private task: IntervalTask | undefined

  constructor(private readonly context: AppContext) {
    super()
  }

  override get enabled(): boolean {
    return this.context.config.presence.enabled
  }

  override onReady(client: Client<true>): Promise<void> {
    const logger = this.context.logger.child(this.name)
    this.task = new IntervalTask('Presence update', UPDATE_INTERVAL_MS, () => this.update(client), logger)
    this.task.start()
    return Promise.resolve()
  }

  override onShutdown(): void {
    this.task?.stop()
  }

  private async update(client: Client<true>): Promise<void> {
    const { presence } = this.context.config
    const status = await this.context.minecraft.getStatus()
    const name = status.online
      ? fill(presence.text.online, { playeronline: status.players.online, playermax: status.players.max })
      : presence.text.offline
    client.user.setPresence({
      status: status.online ? presence.status.online : presence.status.offline,
      activities: [{ name, type: ActivityType[presence.activity] }],
    })
    this.context.logger.child(this.name).debug(`Activity set to "${name}".`)
  }
}
