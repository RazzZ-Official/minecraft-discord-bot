import type { Client, Message } from 'discord.js'
import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import type { SlashCommand } from '../../core/commands/SlashCommand.js'
import type { ButtonHandler } from '../../core/components/ComponentHandler.js'
import type { PanelClient } from '../../services/PanelClient.js'
import { PanelConsole } from '../../services/PanelConsole.js'
import { fill } from '../../shared/format.js'
import { RoleGuard } from '../../shared/RoleGuard.js'
import { TeamAdminCommand } from './commands/TeamAdminCommand.js'
import { TeamCommand } from './commands/TeamCommand.js'
import { TeamInviteCommand } from './commands/TeamInviteCommand.js'
import { AcceptInviteButton, DeclineInviteButton } from './components/InviteButtons.js'
import { TeamText } from './messages.js'
import { TeamDiscord } from './TeamDiscord.js'
import { TeamGameSync } from './TeamGameSync.js'
import { TeamInviteRepository, TeamSettingsRepository } from './TeamRepository.js'
import type { TeamRepository } from './TeamRepository.js'
import { TeamService } from './TeamService.js'
import { TeamSyncScheduler } from './TeamSyncScheduler.js'
import { TeamViews } from './TeamViews.js'

const GALLERY_NOTICE_LIFETIME_MS = 6_000

/**
 * Teams: MC Admins create them with their own role and private chat, gallery and voice channels; leaders invite
 * members by DM; every team is mirrored in game with a coloured [TAG], and resynced on a schedule.
 */
export class TeamsModule extends BotModule {
  readonly name = 'teams'
  private readonly commandList: SlashCommand[] = []
  private readonly buttonList: ButtonHandler[] = []
  private scheduler: TeamSyncScheduler | undefined

  constructor(
    private readonly context: AppContext,
    private readonly teams: TeamRepository
  ) {
    super()
    if (this.enabled && context.panel) this.build(context.panel)
  }

  // Needs the panel credentials in .env for the in-game teams.
  override get enabled(): boolean {
    return this.context.config.teams.enabled && this.context.panel !== null
  }

  override commands(): SlashCommand[] {
    return this.commandList
  }

  override buttons(): ButtonHandler[] {
    return this.buttonList
  }

  override onReady(client: Client<true>): Promise<void> {
    this.scheduler?.start(client)
    return Promise.resolve()
  }

  override onShutdown(): void {
    this.scheduler?.stop()
  }

  /** Keeps team galleries for images and videos: other posts are removed. Replies in threads are allowed. */
  override async onMessage(message: Message): Promise<void> {
    if (message.author.bot || message.channel.isThread() || !this.teams.findByGallery(message.channelId)) return
    const hasMedia = message.attachments.some(
      (attachment) => attachment.contentType?.startsWith('image/') || attachment.contentType?.startsWith('video/')
    )
    if (hasMedia) return
    await message.delete().catch(() => undefined)
    if (!message.channel.isSendable()) return
    const notice = await message.channel.send({
      content: fill(TeamText.replies.galleryOnly, { user: `<@${message.author.id}>` }),
      allowedMentions: { users: [message.author.id] },
    })
    setTimeout(() => void notice.delete().catch(() => undefined), GALLERY_NOTICE_LIFETIME_MS)
  }

  private build(panel: PanelClient): void {
    const { config, links, nicknames, audit, minecraft } = this.context
    const logger = this.context.logger.child(this.name)
    const settings = new TeamSettingsRepository()
    const views = new TeamViews(config.server, links)
    const service = new TeamService(
      config.teams,
      this.teams,
      new TeamInviteRepository(),
      settings,
      new TeamDiscord(config.teams),
      new TeamGameSync(panel, new PanelConsole(panel), links, settings, logger),
      views,
      links,
      nicknames,
      audit,
      logger
    )
    this.scheduler = new TeamSyncScheduler(service, minecraft, audit, config.teams.syncHours, logger)

    this.commandList.push(
      new TeamCommand(service, views),
      new TeamInviteCommand(service, views, config.teams.inviteExpiryHours),
      new TeamAdminCommand(service, new RoleGuard(config.teams.adminRoleIds))
    )
    this.buttonList.push(new AcceptInviteButton(service, views), new DeclineInviteButton(service, views))
  }
}
