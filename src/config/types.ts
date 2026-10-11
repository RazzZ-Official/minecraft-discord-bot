import type { ColorResolvable, PresenceStatusData } from 'discord.js'

export type Edition = 'java' | 'bedrock'

/** "everyone", "here", a role ID, or "" for no mention. */
export type MentionSetting = string

export interface ServerConfig {
  name: string
  ip: string
  port: number
  edition: Edition
  version: string
  icon: string
  site: string
  /** Treat the server as offline when it reports 0 max players (useful while a host is starting the server). */
  zeroMaxPlayersMeansOffline: boolean
}

export interface PresenceConfig {
  enabled: boolean
  activity: 'Playing' | 'Listening' | 'Watching' | 'Competing'
  text: { online: string; offline: string }
  status: { online: PresenceStatusData; offline: PresenceStatusData }
}

export interface LoggingConfig {
  timezone: string
  inviteLink: boolean
  debug: boolean
  serverInfoOnStartup: boolean
}

export interface ColorsConfig {
  basic: ColorResolvable
  online: ColorResolvable
  offline: ColorResolvable
}

export interface PrefixCommandConfig {
  enabled: boolean
  aliases: string[]
}

export interface CommandsConfig {
  slashCommands: boolean
  prefix: { enabled: boolean; prefix: string }
  /** Channels where the public info commands work. Empty means all channels. */
  enabledChannels: string[]
  disabledChannels: string[]
  serverinfo: PrefixCommandConfig
  ip: PrefixCommandConfig
  site: PrefixCommandConfig
  version: PrefixCommandConfig
  players: PrefixCommandConfig
  status: PrefixCommandConfig
  motd: PrefixCommandConfig
  help: PrefixCommandConfig
}

export interface StatusCardConfig {
  enabled: boolean
  updateIntervalSeconds: number
  adminOnly: boolean
  banner: string
  mention: MentionSetting
}

export interface PlayerCountChannelConfig {
  enabled: boolean
  guildId: string
  channelId: string
  onlineText: string
  offlineText: string
}

export interface AutoReplyTrigger {
  enabled: boolean
  triggerWords: string[]
}

export interface AutoReplyConfig {
  enabled: boolean
  deleteAfterSeconds: number
  enabledChannels: string[]
  disabledChannels: string[]
  version: AutoReplyTrigger
  ip: AutoReplyTrigger
  site: AutoReplyTrigger
  status: AutoReplyTrigger
}

export interface ServerInfoConfig {
  color: ColorResolvable
  banner: string
  mention: MentionSetting
}

export interface WhitelistConfig {
  enabled: boolean
  staffChannelId: string
  logChannelId: string
  staffRoleIds: string[]
  banner: string
}

export interface BotConfig {
  server: ServerConfig
  presence: PresenceConfig
  logging: LoggingConfig
  colors: ColorsConfig
  commands: CommandsConfig
  statusCard: StatusCardConfig
  playerCountChannel: PlayerCountChannelConfig
  autoReply: AutoReplyConfig
  serverInfo: ServerInfoConfig
  whitelist: WhitelistConfig
}
