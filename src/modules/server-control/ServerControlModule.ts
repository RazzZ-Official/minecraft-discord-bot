import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import type { SlashCommand } from '../../core/commands/SlashCommand.js'
import type { ButtonHandler } from '../../core/components/ComponentHandler.js'
import { RoleGuard } from '../../shared/RoleGuard.js'
import {
  CancelPowerButton,
  ConfirmPowerButton,
  PowerButton,
  ServerCommand,
  StatusButton,
} from './ServerControlHandlers.js'
import { ServerControlService } from './ServerControlService.js'
import { ServerControlView } from './ServerControlView.js'

/** Start, stop and restart the Minecraft server from Discord, for MC Admins in the server panel channel. */
export class ServerControlModule extends BotModule {
  readonly name = 'server-control'
  private readonly commandList: SlashCommand[] = []
  private readonly buttonList: ButtonHandler[] = []

  constructor(private readonly context: AppContext) {
    super()
    const { panel, config } = context
    if (!this.enabled || !panel) return

    const deps = {
      service: new ServerControlService(panel, context.minecraft, context.audit),
      view: new ServerControlView(config.server),
      guard: new RoleGuard(config.serverControl.roleIds, config.serverControl.channelId),
      audit: context.audit,
    }
    this.commandList.push(new ServerCommand(deps))
    this.buttonList.push(
      new PowerButton(deps),
      new ConfirmPowerButton(deps),
      new CancelPowerButton(),
      new StatusButton(deps)
    )
  }

  // Needs the panel credentials in .env.
  override get enabled(): boolean {
    return this.context.config.serverControl.enabled && this.context.panel !== null
  }

  override commands(): SlashCommand[] {
    return this.commandList
  }

  override buttons(): ButtonHandler[] {
    return this.buttonList
  }
}
