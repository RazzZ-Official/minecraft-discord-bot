import { PermissionFlagsBits } from 'discord.js'
import type { BaseMessageOptions, ChatInputCommandInteraction, Client, Message } from 'discord.js'
import { SlashCommand } from './SlashCommand.js'

export interface ReplyContext {
  client: Client<true>
  /** Whether the member may mention @everyone, so commands only ping when that member could themselves. */
  canMentionEveryone: boolean
  /** Words after a prefix command, eg. ["status"] for "!help status". Empty for slash commands. */
  args: string[]
  /** The slash command interaction, when used as a slash command. */
  interaction?: ChatInputCommandInteraction
}

/**
 * A public command that answers with one message, built the same way for the slash command and the prefix command.
 */
export abstract class ReplyCommand extends SlashCommand {
  override get isPublicInfo(): boolean {
    return true
  }

  abstract buildReply(context: ReplyContext): Promise<BaseMessageOptions>

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply()
    const reply = await this.buildReply({
      client: interaction.client,
      canMentionEveryone: Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone)),
      args: [],
      interaction,
    })
    await interaction.editReply(reply)
  }

  override async executePrefix(message: Message<true>, args: string[]): Promise<void> {
    await message.channel.sendTyping()
    const reply = await this.buildReply({
      client: message.client,
      canMentionEveryone: Boolean(message.member?.permissions.has(PermissionFlagsBits.MentionEveryone)),
      args,
    })
    await message.channel.send(reply)
  }
}
