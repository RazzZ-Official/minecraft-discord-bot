/** Allow and deny lists of channel IDs. An empty allow list allows every channel that is not denied. */
export class ChannelFilter {
  constructor(
    private readonly allowed: readonly string[],
    private readonly denied: readonly string[]
  ) {}

  allows(channelId: string): boolean {
    if (this.allowed.length && !this.allowed.includes(channelId)) return false
    return !this.denied.includes(channelId)
  }
}
