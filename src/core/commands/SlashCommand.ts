import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Message,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js'
import type { PrefixCommandConfig } from '../../config/types.js'

/** Anything that can describe a slash command, such as a SlashCommandBuilder. */
export interface CommandData {
  readonly name: string
  readonly description: string
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody
}

export abstract class SlashCommand {
  abstract readonly data: CommandData

  /** Disabled commands are not registered with Discord. */
  get enabled(): boolean {
    return true
  }

  /**
   * Public info commands follow commands.enabledChannels / disabledChannels and are listed in /help.
   * Staff and setup commands leave this off.
   */
  get isPublicInfo(): boolean {
    return false
  }

  /** When set, the command can also be used as a prefix command, eg. "!ip". */
  get prefix(): PrefixCommandConfig | undefined {
    return undefined
  }

  get name(): string {
    return this.data.name
  }

  abstract execute(interaction: ChatInputCommandInteraction): Promise<void>

  autocomplete?(interaction: AutocompleteInteraction): Promise<void>

  executePrefix?(message: Message<true>, args: string[]): Promise<void>
}
