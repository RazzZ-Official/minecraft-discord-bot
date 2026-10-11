import type { Env } from '../config/env.js'

const REQUEST_TIMEOUT_MS = 10_000
// The panel rate-limits API requests. Rate-limited requests are retried after the wait it asks for.
const RATE_LIMIT_RETRIES = 3
const RATE_LIMIT_DEFAULT_WAIT_MS = 5_000

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

export type PowerAction = 'start' | 'stop' | 'restart'

export interface ServerResources {
  /** eg. "running", "starting", "stopping" or "offline". */
  state: string
  uptimeMs: number
  memoryBytes: number
  cpuPercent: number
  diskBytes: number
}

interface ResourcesResponse {
  attributes: {
    current_state: string
    resources: { uptime: number; memory_bytes: number; cpu_absolute: number; disk_bytes: number }
  }
}

/**
 * Client for the hosting panel's client API (Reviactyl, a Pterodactyl fork). Only routes verified against the panel
 * are used: server resources, power actions, reading files, console commands and the live console connection.
 */
export class PanelClient {
  private constructor(private readonly credentials: PanelCredentials) {}

  /** The panel's address, sent as the Origin of console connections. */
  get origin(): string {
    return this.credentials.url
  }

  /** Returns null when the panel is not configured in .env. */
  static fromEnv(env: Env): PanelClient | null {
    const { PTERO_PANEL_URL: url, PTERO_SERVER_ID: serverId, PTERO_API_KEY: apiKey } = env
    if (!url || !serverId || !apiKey) return null
    return new PanelClient({ url: url.replace(/\/+$/, ''), serverId, apiKey: apiKey.trim() })
  }

  async getResources(): Promise<ServerResources> {
    const { attributes } = (await (await this.request('/resources')).json()) as ResourcesResponse
    const { resources } = attributes
    return {
      state: attributes.current_state,
      uptimeMs: resources.uptime,
      memoryBytes: resources.memory_bytes,
      cpuPercent: resources.cpu_absolute,
      diskBytes: resources.disk_bytes,
    }
  }

  /** The server's uptime in milliseconds, or null when it is not running. */
  async getServerUptime(): Promise<number | null> {
    const resources = await this.getResources()
    return resources.state === 'running' ? resources.uptimeMs : null
  }

  /** Starts, stops or restarts the server. Killing the server is deliberately not offered. */
  async setPower(action: PowerAction): Promise<void> {
    await this.request('/power', { method: 'POST', body: { signal: action } })
  }

  /** A short-lived URL and token for the live console connection (see PanelConsole). */
  async getConsoleCredentials(): Promise<{ socket: string; token: string }> {
    const { data } = (await (await this.request('/websocket')).json()) as { data: { socket: string; token: string } }
    return data
  }

  async readFile(path: string): Promise<string> {
    return (await this.request(`/files/contents?file=${encodeURIComponent(path)}`)).text()
  }

  /**
   * Sends a console command. Callers must only build fixed commands from validated input; see WhitelistGateway and
   * OperatorGateway, the only callers.
   */
  async sendCommand(command: string): Promise<void> {
    await this.request('/command', { method: 'POST', body: { command } })
  }

  private async request(path: string, options: { method?: string; body?: unknown } = {}): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const response = await this.send(path, options)
      if (response.status !== 429 || attempt >= RATE_LIMIT_RETRIES) return this.check(response)
      const retryAfter = Number(response.headers.get('retry-after'))
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : RATE_LIMIT_DEFAULT_WAIT_MS)
      )
    }
  }

  private send(path: string, options: { method?: string; body?: unknown }): Promise<Response> {
    const { url, serverId, apiKey } = this.credentials
    return fetch(`${url}/api/client/servers/${encodeURIComponent(serverId)}${path}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: options.body === undefined ? null : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  }

  private async check(response: Response): Promise<Response> {
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
