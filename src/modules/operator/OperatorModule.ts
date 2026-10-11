import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import type { SlashCommand } from '../../core/commands/SlashCommand.js'
import { RoleGuard } from '../../shared/RoleGuard.js'
import { OperatorCommand } from './OperatorCommand.js'
import { OperatorGateway } from './OperatorGateway.js'

/** In-game operator commands (/mc) for the configured roles, in the MC commands channel. */
export class OperatorModule extends BotModule {
  readonly name = 'operator'
  private readonly commandList: SlashCommand[] = []

  constructor(private readonly context: AppContext) {
    super()
    const { panel, config } = context
    if (!this.enabled || !panel) return
    const guard = new RoleGuard(config.operatorCommands.roleIds, config.operatorCommands.channelId)
    this.commandList.push(new OperatorCommand(new OperatorGateway(panel), guard, context.audit))
  }

  // Needs the panel credentials in .env.
  override get enabled(): boolean {
    return this.context.config.operatorCommands.enabled && this.context.panel !== null
  }

  override commands(): SlashCommand[] {
    return this.commandList
  }
}
