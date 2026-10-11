import type { BaseMessageOptions } from 'discord.js'
import type { Edition } from '../../config/types.js'
import type { AppContext } from '../../core/AppContext.js'
import type { Logger } from '../../core/Logger.js'
import type { ServerAddress } from '../../services/MinecraftStatusService.js'
import { Mention } from '../../shared/Mention.js'
import type { StatusCardView } from './StatusCardView.js'

export interface StatusCardTarget {
  name: string
  ip: string
  port: number
  edition: Edition
  mention: string
}

/** Collects everything a status card shows (status, ping, uptime) and renders it. */
export class StatusCardService {
  private readonly logger: Logger

  constructor(
    private readonly context: AppContext,
    private readonly view: StatusCardView
  ) {
    this.logger = context.logger.child('status-card')
  }

  async render(target: StatusCardTarget, attachedFileNames: readonly string[] = []): Promise<BaseMessageOptions> {
    const address: ServerAddress = { ip: target.ip, port: target.port, edition: target.edition }
    const status = await this.context.minecraft.getStatus(address)
    const [ping, uptime] = status.online
      ? await Promise.all([this.context.minecraft.ping(address), this.uptimeFor(address.ip)])
      : [null, null]
    return this.view.render(
      { name: target.name, address, status, ping, uptime },
      Mention.from(target.mention),
      attachedFileNames
    )
  }

  // The panel only knows the uptime of the configured server, so other servers show N/A.
  private async uptimeFor(ip: string): Promise<number | null> {
    const { panel, config } = this.context
    if (!panel || ip !== config.server.ip) return null
    try {
      return await panel.getServerUptime()
    } catch (error) {
      this.logger.error('Could not read the server uptime from the panel.', error)
      return null
    }
  }
}
