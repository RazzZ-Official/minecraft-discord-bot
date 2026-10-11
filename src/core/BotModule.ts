import type { Client, Message } from 'discord.js'
import type { SlashCommand } from './commands/SlashCommand.js'
import type { ButtonHandler, ModalHandler } from './components/ComponentHandler.js'

/**
 * A feature of the bot. A module groups its commands, component handlers and background work, and the Bot wires
 * them into Discord.
 */
export abstract class BotModule {
  abstract readonly name: string

  /** Whether the module should be loaded at all. */
  get enabled(): boolean {
    return true
  }

  commands(): SlashCommand[] {
    return []
  }

  buttons(): ButtonHandler[] {
    return []
  }

  modals(): ModalHandler[] {
    return []
  }

  /** Called once the bot is logged in. Start background tasks here. */
  onReady?(client: Client<true>): Promise<void>

  /** Called for every message the bot can see. */
  onMessage?(message: Message): Promise<void>

  /** Called when the bot shuts down. */
  onShutdown?(): Promise<void> | void
}
