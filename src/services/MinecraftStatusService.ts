import net from 'node:net'
import { statusBedrock, statusJava } from 'node-mcstatus'
import type { Edition, ServerConfig } from '../config/types.js'

export interface ServerAddress {
  ip: string
  port: number
  edition: Edition
}

export interface OnlinePlayer {
  name: string
  uuid: string | undefined
}

export interface ServerStatus {
  /** Reachable, and not reporting 0 max players when zeroMaxPlayersMeansOffline is on. */
  online: boolean
  motd: string
  version: string | null
  players: {
    online: number
    max: number
    /** Names shared by the server. Bedrock servers and some Java servers do not share them. */
    list: OnlinePlayer[]
  }
}

const CACHE_TTL_MS = 15_000
const PING_TIMEOUT_MS = 3_000

/**
 * Fetches Minecraft server status through the mcstatus.io API. Results are cached briefly, because the presence,
 * player count channel and status messages all ask for the same server every minute.
 */
export class MinecraftStatusService {
  private readonly cache = new Map<string, { status: ServerStatus; expiresAt: number }>()

  constructor(private readonly server: ServerConfig) {}

  /** The server configured in bot.config.ts. */
  get defaultAddress(): ServerAddress {
    return { ip: this.server.ip, port: this.server.port, edition: this.server.edition }
  }

  async getStatus(address: ServerAddress = this.defaultAddress): Promise<ServerStatus> {
    const key = `${address.edition}:${address.ip}:${address.port}`
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.status

    const status = address.edition === 'java' ? await this.fetchJava(address) : await this.fetchBedrock(address)
    this.cache.set(key, { status, expiresAt: Date.now() + CACHE_TTL_MS })
    return status
  }

  /**
   * Measures how long a TCP connection to a Java server takes from the bot, excluding the DNS lookup. Returns null
   * for Bedrock servers, which use UDP, and when the server cannot be reached.
   */
  ping(address: ServerAddress = this.defaultAddress): Promise<number | null> {
    if (address.edition !== 'java') return Promise.resolve(null)
    return new Promise((resolve) => {
      let start = performance.now()
      const socket = net.connect({ host: address.ip, port: address.port, timeout: PING_TIMEOUT_MS })
      const finish = (result: number | null): void => {
        socket.destroy()
        resolve(result)
      }
      socket.once('lookup', () => (start = performance.now()))
      socket.once('connect', () => finish(Math.round(performance.now() - start)))
      socket.once('timeout', () => finish(null))
      socket.once('error', () => finish(null))
    })
  }

  private async fetchJava(address: ServerAddress): Promise<ServerStatus> {
    const result = await statusJava(address.ip, address.port)
    const players = result.players
    return this.normalize(result.online, {
      motd: result.motd?.clean ?? '',
      version: result.version?.name_clean ?? null,
      online: players?.online ?? 0,
      max: players?.max ?? 0,
      list: (players?.list ?? []).map((player) => ({ name: player.name_clean, uuid: player.uuid })),
    })
  }

  private async fetchBedrock(address: ServerAddress): Promise<ServerStatus> {
    const result = await statusBedrock(address.ip, address.port)
    return this.normalize(result.online, {
      motd: result.motd?.clean ?? '',
      version: result.version?.name ?? null,
      online: result.players?.online ?? 0,
      max: result.players?.max ?? 0,
      list: [],
    })
  }

  private normalize(
    reachable: boolean,
    data: { motd: string; version: string | null; online: number; max: number; list: OnlinePlayer[] }
  ): ServerStatus {
    const online = reachable && !(this.server.zeroMaxPlayersMeansOffline && data.max === 0)
    return {
      online,
      motd: data.motd,
      version: data.version,
      players: { online: data.online, max: data.max, list: data.list },
    }
  }
}
