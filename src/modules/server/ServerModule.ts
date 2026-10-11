import chalk from 'chalk'
import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import type { SlashCommand } from '../../core/commands/SlashCommand.js'
import { editionName, formatAddress } from '../../shared/format.js'
import {
  IpCommand,
  MotdCommand,
  PlayersCommand,
  ServerInfoCommand,
  SiteCommand,
  StatusCommand,
  VersionCommand,
} from './commands/InfoCommands.js'
import { ServerViews } from './ServerViews.js'

/** Public commands about the Minecraft server: /serverinfo, /ip, /site, /version, /motd, /players and /status. */
export class ServerModule extends BotModule {
  readonly name = 'server'
  private readonly commandList: SlashCommand[]

  constructor(private readonly context: AppContext) {
    super()
    const deps = { config: context.config, views: new ServerViews(context.config), minecraft: context.minecraft }
    this.commandList = [
      new ServerInfoCommand(deps),
      new IpCommand(deps),
      new SiteCommand(deps),
      new VersionCommand(deps),
      new MotdCommand(deps),
      new PlayersCommand(deps),
      new StatusCommand(deps),
    ]
  }

  override commands(): SlashCommand[] {
    return this.commandList
  }

  override async onReady(): Promise<void> {
    if (!this.context.config.logging.serverInfoOnStartup) return
    const { server } = this.context.config
    const logger = this.context.logger.child(this.name)
    const address = formatAddress(server.ip, server.port, server.edition)
    const status = await this.context.minecraft.getStatus()
    if (status.online) {
      logger.info(
        `${chalk.green('Online')} ${chalk.cyan(address)} | ${server.version} | ` +
          `${status.players.online}/${status.players.max} players | ${status.motd.replace(/\n/g, ' / ')}`
      )
    } else {
      logger.warn(`${chalk.red('Offline')} ${chalk.cyan(address)} (${editionName(server.edition)})`)
    }
  }
}
