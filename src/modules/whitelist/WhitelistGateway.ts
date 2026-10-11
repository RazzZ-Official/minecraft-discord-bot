import { PanelError } from '../../services/PanelClient.js'
import type { PanelClient } from '../../services/PanelClient.js'
import { PlayerName } from './PlayerName.js'
import type { PlayerIdentity, WhitelistEntry } from './PlayerName.js'

// Commands run asynchronously on the server, so whitelist.json is polled to confirm each change.
const VERIFY_ATTEMPTS = 6
const VERIFY_DELAY_MS = 1_500

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Reads and changes the server whitelist through the panel. This is the only place console commands are built, and
 * only from names validated by PlayerName: "whitelist add|remove <name>" for Java and "fwhitelist add|remove" for
 * Bedrock (Floodgate), so no other command can reach the console.
 */
export class WhitelistGateway {
  constructor(private readonly panel: PanelClient) {}

  async list(): Promise<WhitelistEntry[]> {
    const entries: unknown = JSON.parse(await this.panel.readFile('/whitelist.json'))
    return Array.isArray(entries) ? entries.filter(isWhitelistEntry) : []
  }

  async isWhitelisted(whitelistName: string): Promise<boolean> {
    const target = whitelistName.toLowerCase()
    return (await this.list()).some((entry) => entry.name.toLowerCase() === target)
  }

  /** Adds a player and waits until the entry appears. Returns false if it could not be confirmed. */
  async add(player: PlayerIdentity): Promise<boolean> {
    // Re-validate, so nothing but a checked name can ever reach the console.
    const checked = PlayerName.parse(player.edition, player.username)
    if (!checked || checked.username !== player.username) {
      throw new PanelError(`Refusing to whitelist invalid name "${player.username}".`)
    }
    // Floodgate reads the name as a quoted string, which allows gamertags with spaces. Quotes never pass validation.
    const command =
      checked.edition === 'bedrock' ? `fwhitelist add "${checked.username}"` : `whitelist add ${checked.username}`
    await this.panel.sendCommand(command)
    return this.waitUntil(() => this.isWhitelisted(checked.whitelistName))
  }

  /** Removes an entry read from whitelist.json and waits until it is gone. Returns false if it could not be confirmed. */
  async remove(entry: WhitelistEntry): Promise<boolean> {
    const target = PlayerName.removalTarget(entry)
    if (!target) throw new PanelError(`Refusing to remove unsupported whitelist entry "${entry.name}".`)
    const command =
      target.edition === 'bedrock' ? `fwhitelist remove ${target.identifier}` : `whitelist remove ${target.identifier}`
    await this.panel.sendCommand(command)
    return this.waitUntil(async () => !(await this.list()).some((current) => current.uuid === entry.uuid))
  }

  private async waitUntil(check: () => Promise<boolean>): Promise<boolean> {
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
      await sleep(VERIFY_DELAY_MS)
      if (await check()) return true
    }
    return false
  }
}

const isWhitelistEntry = (value: unknown): value is WhitelistEntry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as WhitelistEntry).name === 'string' &&
  typeof (value as WhitelistEntry).uuid === 'string'
