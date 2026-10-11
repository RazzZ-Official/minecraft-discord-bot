// Imports the data of the old JSON-based bot into MongoDB. Safe to run more than once: records are upserted.
// Usage: npm run migrate:json [-- <folder>]   (defaults to ./data-backup with data.json and whitelist-requests.json)
import fs from 'node:fs'
import path from 'node:path'
import { botConfig } from '../config/bot.config.js'
import { loadEnv } from '../config/env.js'
import { Database } from '../core/Database.js'
import { Logger } from '../core/Logger.js'
import { PlayerCountChannelModel } from '../modules/player-count/PlayerCountChannelModel.js'
import { StatusMessageModel } from '../modules/status-card/StatusMessageModel.js'
import { WhitelistRequestModel } from '../modules/whitelist/WhitelistRequestModel.js'

interface LegacyData {
  playerCountStats: string | null
  autoChangeStatus: {
    ip: string
    port: number
    type: 'java' | 'bedrock'
    name: string
    channelId: string
    messageId: string
    mention?: string
  }[]
}

interface LegacyRequest {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  userId: string
  userTag: string
  edition: 'java' | 'bedrock'
  username: string
  whitelistName: string
  staffMessageId?: string
  reason?: string | null
  decidedBy?: string
  decidedAt?: string
  notified?: boolean
}

const readJson = <T>(file: string): T | null =>
  fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : null

const main = async (): Promise<void> => {
  const env = loadEnv()
  const logger = new Logger(botConfig.logging, 'migrate')
  const folder = path.resolve(process.argv[2] ?? 'data-backup')
  const database = new Database(env.MONGODB_URI, logger)
  await database.connect()

  // The old data has no guild IDs for status messages, so ask Discord which guild each channel belongs to.
  const guildOfChannel = async (channelId: string): Promise<string> => {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { Authorization: `Bot ${env.BOT_TOKEN}` },
    })
    const channel = response.ok ? ((await response.json()) as { guild_id?: string }) : {}
    return channel.guild_id ?? botConfig.playerCountChannel.guildId
  }

  const data = readJson<LegacyData>(path.join(folder, 'data.json'))
  if (data?.playerCountStats) {
    await PlayerCountChannelModel.updateOne(
      { guildId: botConfig.playerCountChannel.guildId },
      { channelId: data.playerCountStats },
      { upsert: true }
    )
    logger.info(`Player count channel: ${data.playerCountStats}`)
  }
  for (const entry of data?.autoChangeStatus ?? []) {
    await StatusMessageModel.updateOne(
      { messageId: entry.messageId },
      {
        channelId: entry.channelId,
        guildId: await guildOfChannel(entry.channelId),
        name: entry.name,
        ip: entry.ip,
        port: entry.port,
        edition: entry.type,
        mention: entry.mention ?? '',
      },
      { upsert: true }
    )
    logger.info(`Status message: ${entry.messageId} (${entry.ip}:${entry.port})`)
  }

  const requests = readJson<{ requests: LegacyRequest[] }>(path.join(folder, 'whitelist-requests.json'))?.requests ?? []
  for (const request of requests) {
    const createdAt = new Date(request.createdAt)
    await WhitelistRequestModel.updateOne(
      { requestId: request.id },
      {
        $set: {
          userId: request.userId,
          userTag: request.userTag,
          edition: request.edition,
          username: request.username,
          whitelistName: request.whitelistName,
          status: request.status,
          staffMessageId: request.staffMessageId ?? null,
          reason: request.reason ?? null,
          decidedBy: request.decidedBy ?? null,
          decidedAt: request.decidedAt ? new Date(request.decidedAt) : null,
          notified: request.notified ?? null,
          createdAt,
          updatedAt: new Date(request.decidedAt ?? request.createdAt),
        },
      },
      // Keep the original dates instead of stamping the time of the migration.
      { upsert: true, timestamps: false }
    )
    logger.info(`Whitelist request: ${request.whitelistName} (${request.status})`)
  }

  logger.info(`Done. Imported ${data?.autoChangeStatus.length ?? 0} status messages and ${requests.length} requests.`)
  await database.disconnect()
}

main().catch((error: unknown) => {
  console.error('Migration failed.', error)
  process.exit(1)
})
