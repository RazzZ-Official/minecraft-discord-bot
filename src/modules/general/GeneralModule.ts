import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import type { CommandRegistry } from '../../core/commands/CommandRegistry.js'
import type { SlashCommand } from '../../core/commands/SlashCommand.js'
import { HelpCommand } from './HelpCommand.js'
import { InfoCommand } from './InfoCommand.js'

/** /help and /info. */
export class GeneralModule extends BotModule {
  readonly name = 'general'
  private readonly commandList: SlashCommand[]

  constructor(context: AppContext, registry: CommandRegistry) {
    super()
    this.commandList = [new HelpCommand(context.config.commands, registry), new InfoCommand()]
  }

  override commands(): SlashCommand[] {
    return this.commandList
  }
}
