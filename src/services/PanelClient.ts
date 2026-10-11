import type { Env } from '../config/env.js'

const REQUEST_TIMEOUT_MS = 10_000

export class PanelError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'PanelError'
  }
}

interface PanelCredentials {
  url: string
  serverId: string
  apiKey: string
}

interface PanelErrorResponse {
  errors?: { detail?: string }[]
}

interface ResourcesResponse {
  attributes: { current_state: string; resources: { uptime: number } }
}

/**
 * Client for the hosting panel's client API (Reviactyl, a Pterodactyl fork). Only routes verified against the panel
 * are used: server resources, reading files and sending console commands.
 */
export class PanelClient {
  private constructor(private readonly credentials: PanelCredentials) {}

  /** Returns null when the panel is not configured in .env. */
  static fromEnv(env: Env): PanelClient | null {
    const { PTERO_PANEL_URL: url, PTERO_SERVER_ID: serverId, PTERO_API_KEY: apiKey } = env
    if (!url || !serverId || !apiKey) return null
    return new PanelClient({ url: url.replace(/\/+$/, ''), serverId, apiKey: apiKey.trim() })
  }

  /** The server's uptime in milliseconds, or null when it is not running. */
  async getServerUptime(): Promise<number | null> {
    const { attributes } = (await (await this.request('/resources')).json()) as ResourcesResponse
    return attributes.current_state === 'running' ? attributes.resources.uptime : null
  }

  async readFile(path: string): Promise<string> {
    return (await this.request(`/files/contents?file=${encodeURIComponent(path)}`)).text()
  }

  /**
   * Sends a console command. Callers must only build commands from validated input; see WhitelistGateway, which is
   * the only caller.
   */
  async sendCommand(command: string): Promise<void> {
    await this.request('/command', { method: 'POST', body: { command } })
  }

  private async request(path: string, options: { method?: string; body?: unknown } = {}): Promise<Response> {
    const { url, serverId, apiKey } = this.credentials
    const response = await fetch(`${url}/api/client/servers/${encodeURIComponent(serverId)}${path}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: options.body === undefined ? null : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      const detail = await response
        .json()
        .then((json) => (json as PanelErrorResponse).errors?.[0]?.detail)
        .catch(() => undefined)
      throw new PanelError(detail ?? `Panel responded with HTTP ${response.status}`, response.status)
    }
    return response
  }
}
