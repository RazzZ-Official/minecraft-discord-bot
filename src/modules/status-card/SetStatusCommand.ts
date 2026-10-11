import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { BotConfig, Edition } from '../../config/types.js'
import { SlashCommand } from '../../core/commands/SlashCommand.js'
import type { CommandData } from '../../core/commands/SlashCommand.js'
import type { Logger } from '../../core/Logger.js'
import { fill } from '../../shared/format.js'
import { Mention } from '../../shared/Mention.js'
import type { StatusCardService } from './StatusCardService.js'
import { StatusMessageModel } from './StatusMessageModel.js'

const Text = {
  description: 'Sets a live status message of the Minecraft server in this channel.',
  name: 'Name of the Minecraft server. Defaults to the name in the config.',
  ip: 'IP address of the Minecraft server. Defaults to the IP in the config.',
  port: 'Port of the Minecraft server. Defaults to the port in the config.',
  edition: 'Java or Bedrock. Defaults to the edition in the config.',
  checking: ':arrows_clockwise: Checking the status...',
  invalidIp: ':warning: **`{ip}` is not a valid server address.**',
  notTextChannel: ':warning: **Status messages can only be set in text channels.**',
  success: ':white_check_mark: **Status message set in {channel}:** {link}',
} as const

/** Posts a status message that the StatusCardUpdater keeps up to date. Every option defaults to the config. */
export class SetStatusCommand extends SlashCommand {
  readonly data: CommandData

  constructor(
    private readonly config: BotConfig,
    private readonly service: StatusCardService,
    private readonly logger: Logger
  ) {
    super()
    const builder = new SlashCommandBuilder()
      .setName('setstatus')
      .setDescription(Text.description)
      .addStringOption((option) => option.setName('name').setDescription(Text.name))
      .addStringOption((option) => option.setName('ip').setDescription(Text.ip))
      .addIntegerOption((option) => option.setName('port').setDescription(Text.port).setMinValue(1).setMaxValue(65535))
      .addStringOption((option) =>
        option
          .setName('edition')
          .setDescription(Text.edition)
          .addChoices({ name: 'Java', value: 'java' }, { name: 'Bedrock', value: 'bedrock' })
      )
    if (config.statusCard.adminOnly) builder.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    this.data = builder
  }

  override get enabled(): boolean {
    return this.config.statusCard.enabled
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const { server, statusCard } = this.config
    const target = {
      name: interaction.options.getString('name') ?? server.name,
      ip: interaction.options.getString('ip') ?? server.ip,
      port: interaction.options.getInteger('port') ?? server.port,
      edition: (interaction.options.getString('edition') as Edition | null) ?? server.edition,
      // The mention pings once, now. Later updates are edits, which never ping.
      mention: interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone) ? statusCard.mention : '',
    }
    if (!target.ip.includes('.')) {
      await interaction.editReply(fill(Text.invalidIp, { ip: target.ip }))
      return
    }
    if (!interaction.inGuild() || !interaction.channel?.isSendable()) {
      await interaction.editReply(Text.notTextChannel)
      return
    }

    const mention = Mention.from(target.mention)
    const message = await interaction.channel.send({
      content: `${mention.text} ${Text.checking}`.trim(),
      allowedMentions: mention.allowedMentions,
    })
    await StatusMessageModel.create({
      ...target,
      messageId: message.id,
      channelId: message.channelId,
      guildId: interaction.guildId,
    })
    await message.edit(await this.service.render(target))

    await interaction.editReply(fill(Text.success, { channel: `<#${message.channelId}>`, link: message.url }))
    this.logger.info(`Status message set in #${'name' in message.channel ? message.channel.name : message.channelId}.`)
  }
}
