import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js'
import type { SlashCommand } from './SlashCommand.js'

/** All enabled commands, looked up by slash command name or prefix alias. */
export class CommandRegistry {
  private readonly commands = new Map<string, SlashCommand>()

  add(command: SlashCommand): void {
    if (!command.enabled) return
    if (this.commands.has(command.name)) throw new Error(`Duplicate command name "${command.name}".`)
    this.commands.set(command.name, command)
  }

  get(name: string): SlashCommand | undefined {
    return this.commands.get(name)
  }

  /** Finds a prefix command by its name or one of its aliases. */
  findPrefixCommand(word: string): SlashCommand | undefined {
    const name = word.toLowerCase()
    return this.all().find(
      (command) =>
        command.prefix?.enabled &&
        command.executePrefix &&
        (command.name === name || command.prefix.aliases.includes(name))
    )
  }

  all(): SlashCommand[] {
    return [...this.commands.values()]
  }

  /** Public info commands, as listed in /help. */
  publicCommands(): SlashCommand[] {
    return this.all().filter((command) => command.isPublicInfo)
  }

  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return this.all().map((command) => command.data.toJSON())
  }
}
