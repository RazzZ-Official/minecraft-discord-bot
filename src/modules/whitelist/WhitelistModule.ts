import type { Client } from 'discord.js'
import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import type { SlashCommand } from '../../core/commands/SlashCommand.js'
import type { ButtonHandler, ModalHandler } from '../../core/components/ComponentHandler.js'
import type { PanelClient } from '../../services/PanelClient.js'
import { SetWhitelistCommand } from './commands/SetWhitelistCommand.js'
import { WhitelistCommand } from './commands/WhitelistCommand.js'
import { ApproveButton, RejectButton, RejectReasonModal } from './components/DecisionHandlers.js'
import { OpenRequestFormButton, RequestFormModal } from './components/RequestFormHandlers.js'
import { StaffGuard } from './StaffGuard.js'
import { WhitelistGateway } from './WhitelistGateway.js'
import { WhitelistNotifier } from './WhitelistNotifier.js'
import { WhitelistRequestRepository } from './WhitelistRequestRepository.js'
import { WhitelistService } from './WhitelistService.js'
import { WhitelistViews } from './WhitelistViews.js'

/**
 * Whitelist requests: players apply through the /setwhitelist panel, staff approve or reject them in the staff
 * channel, and approved players are added on the server through the panel.
 */
export class WhitelistModule extends BotModule {
  readonly name = 'whitelist'
  private readonly commandList: SlashCommand[] = []
  private readonly buttonList: ButtonHandler[] = []
  private readonly modalList: ModalHandler[] = []
  private service: WhitelistService | undefined

  constructor(private readonly context: AppContext) {
    super()
    if (!this.enabled || !context.panel) return
    this.build(context, context.panel)
  }

  // Needs the panel credentials in .env to change the server whitelist.
  override get enabled(): boolean {
    return this.context.config.whitelist.enabled && this.context.panel !== null
  }

  override commands(): SlashCommand[] {
    return this.commandList
  }

  override buttons(): ButtonHandler[] {
    return this.buttonList
  }

  override modals(): ModalHandler[] {
    return this.modalList
  }

  // Links players who were approved before account linking existed.
  override async onReady(client: Client<true>): Promise<void> {
    if (!this.service) return
    const staffChannel = await client.channels.fetch(this.context.config.whitelist.staffChannelId).catch(() => null)
    const guild = staffChannel && 'guild' in staffChannel ? staffChannel.guild : null
    const linked = await this.service.backfillLinks(guild)
    if (linked) this.context.logger.child(this.name).info(`Linked ${linked} previously approved players.`)
  }

  private build(context: AppContext, panel: PanelClient): void {
    const { config } = context
    const logger = context.logger.child(this.name)
    const views = new WhitelistViews(config)
    const guard = new StaffGuard(config.whitelist)
    const service = new WhitelistService(
      new WhitelistRequestRepository(),
      new WhitelistGateway(panel),
      new WhitelistNotifier(config.whitelist, views, context.audit),
      context.links,
      context.nicknames,
      context.audit,
      logger
    )
    this.service = service
    const deps = { service, views, guard }

    this.commandList.push(
      new WhitelistCommand(service, views, guard),
      new SetWhitelistCommand(views, guard, context.audit)
    )
    this.buttonList.push(new ApproveButton(deps), new RejectButton(deps), new OpenRequestFormButton(views))
    this.modalList.push(new RejectReasonModal(deps), new RequestFormModal(service))
  }
}
