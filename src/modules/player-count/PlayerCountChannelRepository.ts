import { JsonStore } from '../../core/JsonStore.js'

/** The voice channel whose name shows the player count, one per guild, in datas/player-count-channels.json. */
interface PlayerCountChannel {
  guildId: string
  channelId: string
}

export class PlayerCountChannelRepository {
  private readonly store = new JsonStore<PlayerCountChannel>('player-count-channels')

  channelFor(guildId: string): string | null {
    return this.store.find((entry) => entry.guildId === guildId)?.channelId ?? null
  }

  async save(guildId: string, channelId: string): Promise<void> {
    await this.store.upsert((entry) => entry.guildId === guildId, { guildId, channelId })
  }
}
