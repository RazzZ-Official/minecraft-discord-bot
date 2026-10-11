import { PanelError } from '../../services/PanelClient.js'
import type { PanelClient } from '../../services/PanelClient.js'
import { waitUntil } from '../../shared/waitUntil.js'

export type OperatorAction = 'op' | 'deop' | 'kick' | 'ban' | 'unban' | 'broadcast'

/** "sent" when the server gives no file to confirm the result (kick, broadcast). */
export type OperatorResult = 'confirmed' | 'not-confirmed' | 'sent'

// Java names (3-16 letters, numbers, underscores), or Bedrock names with the Floodgate prefix, eg. ".Connor_Leo2299".
const PLAYER_NAME = /^\.?[A-Za-z0-9_]{2,16}$/
const MAX_TEXT_LENGTH = 200

/**
 * In-game operator commands through the panel console. Only these fixed commands can be built, and only from a
 * validated player name and cleaned text, so no other console command can be sent.
 */
export class OperatorGateway {
  constructor(private readonly panel: PanelClient) {}

  static isValidPlayer(name: string): boolean {
    return PLAYER_NAME.test(name)
  }

  /** Text for reasons and broadcasts: one line, no control characters. */
  static cleanText(text: string): string {
    return text
      .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TEXT_LENGTH)
  }

  async op(player: string): Promise<OperatorResult> {
    await this.send(`op ${this.player(player)}`)
    return this.confirm(() => this.listContains('/ops.json', player))
  }

  async deop(player: string): Promise<OperatorResult> {
    await this.send(`deop ${this.player(player)}`)
    return this.confirm(async () => !(await this.listContains('/ops.json', player)))
  }

  async kick(player: string, reason: string): Promise<OperatorResult> {
    await this.send(`kick ${this.player(player)} ${OperatorGateway.cleanText(reason)}`.trim())
    return 'sent'
  }

  async ban(player: string, reason: string): Promise<OperatorResult> {
    await this.send(`ban ${this.player(player)} ${OperatorGateway.cleanText(reason)}`.trim())
    return this.confirm(() => this.listContains('/banned-players.json', player))
  }

  async unban(player: string): Promise<OperatorResult> {
    await this.send(`pardon ${this.player(player)}`)
    return this.confirm(async () => !(await this.listContains('/banned-players.json', player)))
  }

  async broadcast(message: string): Promise<OperatorResult> {
    const text = OperatorGateway.cleanText(message)
    if (!text) throw new PanelError('The message is empty.')
    await this.send(`say ${text}`)
    return 'sent'
  }

  private player(name: string): string {
    if (!OperatorGateway.isValidPlayer(name)) throw new PanelError(`"${name}" is not a valid player name.`)
    return name
  }

  private send(command: string): Promise<void> {
    return this.panel.sendCommand(command)
  }

  private async confirm(check: () => Promise<boolean>): Promise<OperatorResult> {
    return (await waitUntil(check)) ? 'confirmed' : 'not-confirmed'
  }

  // Whether ops.json or banned-players.json lists the player, case-insensitively.
  private async listContains(file: string, player: string): Promise<boolean> {
    const entries: unknown = JSON.parse(await this.panel.readFile(file))
    if (!Array.isArray(entries)) return false
    const target = player.toLowerCase()
    return entries.some(
      (entry: { name?: unknown }) => typeof entry.name === 'string' && entry.name.toLowerCase() === target
    )
  }
}
