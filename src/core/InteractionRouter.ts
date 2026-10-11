import { MessageFlags } from 'discord.js'
import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  ModalSubmitInteraction,
} from 'discord.js'
import type { ChannelFilter } from '../shared/ChannelFilter.js'
import type { CommandRegistry } from './commands/CommandRegistry.js'
import type { ButtonHandler, ModalHandler } from './components/ComponentHandler.js'
import { CustomId } from './CustomId.js'
import type { Logger } from './Logger.js'
import { CoreText } from './messages.js'

type RepliableInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction

/** Sends slash commands, autocomplete, buttons and modals to the right handler, and handles their errors. */
export class InteractionRouter {
  private readonly buttons = new Map<string, ButtonHandler>()
  private readonly modals = new Map<string, ModalHandler>()

  constructor(
    private readonly commands: CommandRegistry,
    private readonly channelFilter: ChannelFilter,
    private readonly logger: Logger
  ) {}

  addButton(handler: ButtonHandler): void {
    this.buttons.set(handler.customId, handler)
  }

  addModal(handler: ModalHandler): void {
    this.modals.set(handler.customId, handler)
  }

  async handle(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) await this.handleCommand(interaction)
    else if (interaction.isAutocomplete()) await this.handleAutocomplete(interaction)
    else if (interaction.isButton()) await this.handleComponent(interaction, this.buttons)
    else if (interaction.isModalSubmit()) await this.handleComponent(interaction, this.modals)
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName)
    if (!command) return
    if (command.isPublicInfo && !this.channelFilter.allows(interaction.channelId)) {
      await interaction.reply({ content: CoreText.disabledChannel, flags: MessageFlags.Ephemeral })
      return
    }
    await this.run(interaction, `/${command.name}`, () => command.execute(interaction))
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName)
    if (!command?.autocomplete) return
    try {
      await command.autocomplete(interaction)
    } catch (error) {
      this.logger.error(`Autocomplete for /${command.name} failed.`, error)
      await interaction.respond([]).catch(() => undefined)
    }
  }

  private async handleComponent<T extends ButtonInteraction | ModalSubmitInteraction>(
    interaction: T,
    handlers: Map<string, { handle(interaction: T, argument: string | undefined): Promise<void> }>
  ): Promise<void> {
    const { base, argument } = CustomId.parse(interaction.customId)
    const handler = handlers.get(base)
    if (!handler) return
    await this.run(interaction, base, () => handler.handle(interaction, argument))
  }

  private async run(interaction: RepliableInteraction, label: string, action: () => Promise<void>): Promise<void> {
    try {
      await action()
    } catch (error) {
      this.logger.error(`${label} failed.`, error)
      const reply =
        interaction.deferred || interaction.replied
          ? interaction.followUp({ content: CoreText.error, flags: MessageFlags.Ephemeral })
          : interaction.reply({ content: CoreText.error, flags: MessageFlags.Ephemeral })
      await reply.catch(() => undefined)
    }
  }
}
