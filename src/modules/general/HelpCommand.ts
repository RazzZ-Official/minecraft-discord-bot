import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import type { BaseMessageOptions, Client } from 'discord.js'
import type { CommandsConfig, PrefixCommandConfig } from '../../config/types.js'
import type { CommandRegistry } from '../../core/commands/CommandRegistry.js'
import { ReplyCommand } from '../../core/commands/ReplyCommand.js'
import type { ReplyContext } from '../../core/commands/ReplyCommand.js'
import type { CommandData, SlashCommand } from '../../core/commands/SlashCommand.js'
import { fill } from '../../shared/format.js'
import { GeneralText } from './messages.js'

const COMMAND_NAME = 'help'
const OPTION_NAME = 'command'
const text = GeneralText.help

/** Lists the public commands, or shows the details of one with /help <command> or !help <command>. */
export class HelpCommand extends ReplyCommand {
  constructor(
    private readonly config: CommandsConfig,
    private readonly registry: CommandRegistry
  ) {
    super()
  }

  // Fixed, because the data below lists every public command by name, this one included.
  override get name(): string {
    return COMMAND_NAME
  }

  // Built when the commands are registered, because the choices depend on which commands are enabled.
  get data(): CommandData {
    const choices = this.registry.publicCommands().map((command) => ({ name: command.name, value: command.name }))
    return new SlashCommandBuilder()
      .setName(COMMAND_NAME)
      .setDescription(text.description)
      .addStringOption((option) =>
        option
          .setName(OPTION_NAME)
          .setDescription(text.optionDescription)
          .addChoices(...choices)
      )
  }

  override get enabled(): boolean {
    return this.config.help.enabled
  }

  override get prefix(): PrefixCommandConfig {
    return this.config.help
  }

  async buildReply({ client, args, interaction }: ReplyContext): Promise<BaseMessageOptions> {
    const requested = interaction?.options.getString(OPTION_NAME) ?? args[0]
    const command = requested ? this.registry.publicCommands().find((entry) => entry.name === requested) : undefined
    const mentions = await this.slashMentions(client)
    const embed = command ? this.detailEmbed(command, mentions) : this.listEmbed(mentions)
    return {
      embeds: [
        embed.setColor('Yellow').setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() }),
      ],
    }
  }

  private listEmbed(mentions: Map<string, string>): EmbedBuilder {
    const lines = this.registry.publicCommands().map((command) =>
      fill(text.listItem, {
        mention: mentions.get(command.name) ?? `/${command.name}`,
        description: command.data.description,
      })
    )
    return new EmbedBuilder()
      .setTitle(text.title)
      .setDescription([fill(text.prefixLine, { prefix: this.config.prefix.prefix }), ...lines].join('\n'))
  }

  private detailEmbed(command: SlashCommand, mentions: Map<string, string>): EmbedBuilder {
    const aliases = command.prefix?.aliases ?? []
    return new EmbedBuilder()
      .setTitle(fill(text.detailTitle, { name: command.name.charAt(0).toUpperCase() + command.name.slice(1) }))
      .setDescription(
        fill(text.detail, {
          mention: mentions.get(command.name) ?? `/${command.name}`,
          description: command.data.description,
          prefixCommand: `${this.config.prefix.prefix}${command.name}`,
          aliases: aliases.length ? `\`${aliases.join('`, `')}\`` : text.noAliases,
        })
      )
  }

  // Clickable mentions such as </status:123>, which need the IDs Discord gave the registered commands.
  private async slashMentions(client: Client<true>): Promise<Map<string, string>> {
    const registered = await client.application.commands.fetch()
    return new Map(registered.map((command) => [command.name, `</${command.name}:${command.id}>`]))
  }
}
