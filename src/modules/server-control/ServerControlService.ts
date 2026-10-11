import type { Client, User } from 'discord.js'
import type { AuditLog } from '../../services/AuditLog.js'
import type { MinecraftStatusService, ServerStatus } from '../../services/MinecraftStatusService.js'
import type { PanelClient, PowerAction, ServerResources } from '../../services/PanelClient.js'
import { PowerLabels } from './messages.js'

export type PowerResult = { kind: 'sent' } | { kind: 'busy' } | { kind: 'failed'; message: string }

/** Power actions and status through the panel. Every power action is recorded in the audit log. */
export class ServerControlService {
  // One power action at a time, so two admins cannot fire conflicting signals together.
  private busy = false

  constructor(
    private readonly panel: PanelClient,
    private readonly minecraft: MinecraftStatusService,
    private readonly audit: AuditLog
  ) {}

  async power(client: Client, action: PowerAction, admin: User): Promise<PowerResult> {
    if (this.busy) return { kind: 'busy' }
    this.busy = true
    try {
      await this.panel.setPower(action)
    } catch (error) {
      return { kind: 'failed', message: error instanceof Error ? error.message : String(error) }
    } finally {
      this.busy = false
    }
    const { emoji, verb } = PowerLabels[action]
    await this.audit.record(client, {
      actor: admin,
      action: `${emoji} Server ${verb.toLowerCase()}`,
      summary: `sent "${action}" to the Minecraft server.`,
      color: action === 'stop' ? 'Red' : action === 'start' ? 'Green' : 'Blue',
    })
    return { kind: 'sent' }
  }

  async status(): Promise<{ resources: ServerResources; status: ServerStatus | null }> {
    const [resources, status] = await Promise.all([
      this.panel.getResources(),
      this.minecraft.getStatus().catch(() => null),
    ])
    return { resources, status }
  }
}
