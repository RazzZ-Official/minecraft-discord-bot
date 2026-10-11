import type { Client } from 'discord.js'
import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import type { SlashCommand } from '../../core/commands/SlashCommand.js'
import { IntervalTask } from '../../core/IntervalTask.js'
import type { Logger } from '../../core/Logger.js'
import { SetStatusCommand } from './SetStatusCommand.js'
import { StatusCardService } from './StatusCardService.js'
import { StatusCardUpdater } from './StatusCardUpdater.js'
import { StatusCardView } from './StatusCardView.js'

/** Live status messages: /setstatus posts one, and the updater edits them all on an interval. */
export class StatusCardModule extends BotModule {
  readonly name = 'status-card'
  private readonly logger: Logger
  private readonly updater: StatusCardUpdater
  private readonly setStatus: SetStatusCommand
  private task: IntervalTask | undefined

  constructor(private readonly context: AppContext) {
    super()
    this.logger = context.logger.child(this.name)
    const service = new StatusCardService(context, new StatusCardView(context.config))
    this.updater = new StatusCardUpdater(service, this.logger)
    this.setStatus = new SetStatusCommand(context.config, service, this.logger)
  }

  override get enabled(): boolean {
    return this.context.config.statusCard.enabled
  }

  override commands(): SlashCommand[] {
    return [this.setStatus]
  }

  override onReady(client: Client<true>): Promise<void> {
    const intervalMs = this.context.config.statusCard.updateIntervalSeconds * 1000
    this.task = new IntervalTask('Status message update', intervalMs, () => this.updater.updateAll(client), this.logger)
    this.task.start()
    return Promise.resolve()
  }

  override onShutdown(): void {
    this.task?.stop()
  }
}
