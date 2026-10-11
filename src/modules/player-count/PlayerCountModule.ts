import { ChannelType, PermissionFlagsBits } from 'discord.js'
import type { Client, Guild, VoiceBasedChannel } from 'discord.js'
import type { AppContext } from '../../core/AppContext.js'
import { BotModule } from '../../core/BotModule.js'
import { IntervalTask } from '../../core/IntervalTask.js'
import type { Logger } from '../../core/Logger.js'
import { fill } from '../../shared/format.js'
import { PlayerCountChannelModel } from './PlayerCountChannelModel.js'

const UPDATE_INTERVAL_MS = 60_000

/**
 * Keeps a voice channel's name set to the player count. Uses the channel from the config, the one saved in the
 * database, or creates a new one.
 */
export class PlayerCountModule extends BotModule {
  readonly name = 'player-count'
  private readonly logger: Logger
  private task: IntervalTask | undefined

  constructor(private readonly context: AppContext) {
    super()
    this.logger = context.logger.child(this.name)
  }

  override get enabled(): boolean {
    return this.context.config.playerCountChannel.enabled
  }

  override async onReady(client: Client<true>): Promise<void> {
    const { guildId } = this.context.config.playerCountChannel
    const guild = client.guilds.cache.get(guildId)
    if (!guild) {
      this.logger.error(`Guild ${guildId} was not found, or the bot is not in it. The player count channel is off.`)
      return
    }
    const channel = await this.resolveChannel(guild)
    if (!channel) return

    this.task = new IntervalTask('Player count update', UPDATE_INTERVAL_MS, () => this.update(channel), this.logger)
    this.task.start()
  }

  override onShutdown(): void {
    this.task?.stop()
  }

  private async update(channel: VoiceBasedChannel): Promise<void> {
    const name = await this.channelName()
    // Discord only allows two renames per 10 minutes, so skip unchanged names.
    if (channel.name === name) return
    await channel.setName(name)
    this.logger.debug(`Channel renamed to "${name}".`)
  }

  private async channelName(): Promise<string> {
    const { onlineText, offlineText } = this.context.config.playerCountChannel
    const status = await this.context.minecraft.getStatus()
    if (!status.online) return offlineText
    return fill(onlineText, { playeronline: status.players.online, playermax: status.players.max })
  }

  private async resolveChannel(guild: Guild): Promise<VoiceBasedChannel | null> {
    const configured = this.context.config.playerCountChannel.channelId
    if (configured) {
      const channel = await this.fetchVoiceChannel(guild, configured)
      if (!channel) this.logger.error(`Channel ${configured} from the config was not found, or is not a voice channel.`)
      else await this.save(guild.id, channel.id)
      return channel
    }

    const saved = await PlayerCountChannelModel.findOne({ guildId: guild.id }).lean()
    const existing = saved ? await this.fetchVoiceChannel(guild, saved.channelId) : null
    if (existing) return existing

    const created = await guild.channels.create({
      name: await this.channelName(),
      type: ChannelType.GuildVoice,
      permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }],
    })
    await this.save(guild.id, created.id)
    this.logger.info(`Created the player count channel "${created.name}".`)
    return created
  }

  private async fetchVoiceChannel(guild: Guild, channelId: string): Promise<VoiceBasedChannel | null> {
    const channel = await guild.channels.fetch(channelId).catch(() => null)
    return channel?.isVoiceBased() ? channel : null
  }

  private async save(guildId: string, channelId: string): Promise<void> {
    await PlayerCountChannelModel.updateOne({ guildId }, { channelId }, { upsert: true })
  }
}
