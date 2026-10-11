import { botConfig } from './config/bot.config.js'
import { loadEnv } from './config/env.js'
import type { AppContext } from './core/AppContext.js'
import { Bot } from './core/Bot.js'
import { CommandRegistry } from './core/commands/CommandRegistry.js'
import { Database } from './core/Database.js'
import { Logger } from './core/Logger.js'
import { AutoReplyModule } from './modules/auto-reply/AutoReplyModule.js'
import { GeneralModule } from './modules/general/GeneralModule.js'
import { PlayerCountModule } from './modules/player-count/PlayerCountModule.js'
import { PresenceModule } from './modules/presence/PresenceModule.js'
import { ServerModule } from './modules/server/ServerModule.js'
import { StatusCardModule } from './modules/status-card/StatusCardModule.js'
import { WhitelistModule } from './modules/whitelist/WhitelistModule.js'
import { MinecraftStatusService } from './services/MinecraftStatusService.js'
import { PanelClient } from './services/PanelClient.js'

// Composition root: builds the shared services and modules, then starts the bot.
const main = async (): Promise<void> => {
  const env = loadEnv()
  const logger = new Logger(botConfig.logging)
  const context: AppContext = {
    config: botConfig,
    env,
    logger,
    minecraft: new MinecraftStatusService(botConfig.server),
    panel: PanelClient.fromEnv(env),
  }
  if (botConfig.whitelist.enabled && !context.panel) {
    logger.warn(
      'The whitelist is enabled, but PTERO_PANEL_URL, PTERO_SERVER_ID or PTERO_API_KEY is missing. It is off.'
    )
  }

  const database = new Database(env.MONGODB_URI, logger.child('database'))
  await database.connect()

  const registry = new CommandRegistry()
  // Modules are listed in /help in this order.
  const bot = new Bot(context, registry, [
    new ServerModule(context),
    new GeneralModule(context, registry),
    new StatusCardModule(context),
    new PresenceModule(context),
    new PlayerCountModule(context),
    new AutoReplyModule(context),
    new WhitelistModule(context),
  ])

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down.`)
    await bot.stop()
    await database.disconnect()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection.', reason))

  await bot.start()
}

main().catch((error: unknown) => {
  console.error('The bot failed to start.', error)
  process.exit(1)
})
