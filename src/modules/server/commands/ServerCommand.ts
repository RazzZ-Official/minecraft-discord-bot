import type { BotConfig, CommandsConfig, PrefixCommandConfig } from '../../../config/types.js'
import { ReplyCommand } from '../../../core/commands/ReplyCommand.js'
import type { MinecraftStatusService } from '../../../services/MinecraftStatusService.js'
import type { ServerViews } from '../ServerViews.js'

export interface ServerCommandDeps {
  config: BotConfig
  views: ServerViews
  minecraft: MinecraftStatusService
}

type ServerCommandKey = keyof Pick<
  CommandsConfig,
  'serverinfo' | 'ip' | 'site' | 'version' | 'players' | 'status' | 'motd'
>

/** Base for the public server commands: enabled state and prefix aliases come from commands.<key> in the config. */
export abstract class ServerCommand extends ReplyCommand {
  protected abstract readonly key: ServerCommandKey

  constructor(protected readonly deps: ServerCommandDeps) {
    super()
  }

  override get enabled(): boolean {
    return this.deps.config.commands[this.key].enabled
  }

  override get prefix(): PrefixCommandConfig {
    return this.deps.config.commands[this.key]
  }
}
