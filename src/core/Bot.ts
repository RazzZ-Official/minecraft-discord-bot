import chalk from 'chalk'
import { Client, Events, GatewayIntentBits } from 'discord.js'
import { ChannelFilter } from '../shared/ChannelFilter.js'
import type { AppContext } from './AppContext.js'
import type { BotModule } from './BotModule.js'
import type { CommandRegistry } from './commands/CommandRegistry.js'
import { InteractionRouter } from './InteractionRouter.js'
import type { Logger } from './Logger.js'
import { PrefixCommandRouter } from './PrefixCommandRouter.js'

/** Owns the Discord client, wires the modules into it and keeps the slash commands in sync with Discord. */
export class Bot {
  readonly client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  })

  private readonly modules: BotModule[]
  private readonly interactions: InteractionRouter
  private readonly prefixCommands: PrefixCommandRouter
  private readonly logger: Logger

  constructor(
    private readonly context: AppContext,
    private readonly commands: CommandRegistry,
    modules: BotModule[]
  ) {
    const { config } = context
    this.logger = context.logger.child('bot')
    this.modules = modules.filter((module) => module.enabled)

    const channelFilter = new ChannelFilter(config.commands.enabledChannels, config.commands.disabledChannels)
    this.interactions = new InteractionRouter(commands, channelFilter, context.logger.child('interactions'))
    this.prefixCommands = new PrefixCommandRouter(
      config.commands,
      commands,
      channelFilter,
      context.logger.child('prefix')
    )

    for (const module of this.modules) {
      module.commands().forEach((command) => commands.add(command))
      module.buttons().forEach((handler) => this.interactions.addButton(handler))
      module.modals().forEach((handler) => this.interactions.addModal(handler))
    }
  }

  async start(): Promise<void> {
    this.client.once(Events.ClientReady, (client) => void this.onReady(client))
    this.client.on(Events.InteractionCreate, (interaction) => void this.interactions.handle(interaction))
    this.client.on(Events.MessageCreate, (message) => {
      void this.prefixCommands.handle(message)
      for (const module of this.modules) {
        module
          .onMessage?.(message)
          .catch((error: unknown) => this.logger.error(`${module.name}: message failed.`, error))
      }
    })
    await this.client.login(this.context.env.BOT_TOKEN)
  }

  async stop(): Promise<void> {
    for (const module of this.modules) await module.onShutdown?.()
    await this.client.destroy()
  }

  private async onReady(client: Client<true>): Promise<void> {
    this.logger.info(
      `Logged in as ${chalk.cyan(client.user.tag)}. Modules: ${this.modules.map((m) => m.name).join(', ')}.`
    )
    if (this.context.config.logging.inviteLink) {
      const invite = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`
      this.logger.info(`Invite link: ${chalk.cyan(invite)}`)
    }

    await this.deployCommands(client)
    for (const module of this.modules) {
      await module
        .onReady?.(client)
        .catch((error: unknown) => this.logger.error(`${module.name}: startup failed.`, error))
    }
  }

  // Replaces the registered global commands, so disabled or removed commands disappear from Discord.
  private async deployCommands(client: Client<true>): Promise<void> {
    const commands = this.context.config.commands.slashCommands ? this.commands.toJSON() : []
    await client.application.commands.set(commands)
    this.logger.info(`Registered ${commands.length} slash commands.`)
  }
}
