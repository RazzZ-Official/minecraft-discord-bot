import type { Env } from '../config/env.js'
import type { BotConfig } from '../config/types.js'
import type { MinecraftStatusService } from '../services/MinecraftStatusService.js'
import type { PanelClient } from '../services/PanelClient.js'
import type { Logger } from './Logger.js'

/** Shared dependencies handed to every module. Built once in src/index.ts. */
export interface AppContext {
  config: BotConfig
  env: Env
  logger: Logger
  minecraft: MinecraftStatusService
  /** Null when the panel is not configured in .env. */
  panel: PanelClient | null
}
