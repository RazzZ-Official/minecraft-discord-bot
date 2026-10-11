import type { Logger } from './Logger.js'

/**
 * Runs an async task now and then on a fixed interval. A run is skipped while the previous one is still going, and
 * errors are logged instead of crashing the bot.
 */
export class IntervalTask {
  private timer: NodeJS.Timeout | undefined
  private running = false

  constructor(
    private readonly name: string,
    private readonly intervalMs: number,
    private readonly task: () => Promise<void>,
    private readonly logger: Logger
  ) {}

  start(): void {
    if (this.timer) return
    void this.run()
    this.timer = setInterval(() => void this.run(), this.intervalMs)
  }

  stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
  }

  private async run(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      await this.task()
    } catch (error) {
      this.logger.error(`${this.name} failed.`, error)
    } finally {
      this.running = false
    }
  }
}
