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

export interface PresenceActivity {
  /** "Custom" shows the text on its own, like a custom status. */
  type: 'Playing' | 'Listening' | 'Watching' | 'Competing' | 'Custom'
  text: string
}

export interface PresenceConfig {
  enabled: boolean
  /** Seconds each activity is shown before the next one. Discord limits presence updates, so keep it at 15 or more. */
  rotateSeconds: number
  /** Activities shown in turn while the server is online, and while it is offline. */
  online: PresenceActivity[]
  offline: PresenceActivity[]
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
  staffRoleIds: string[]
  banner: string
}

/** A feature limited to members with one of the roles, used in one channel. */
export interface RestrictedFeatureConfig {
  enabled: boolean
  roleIds: string[]
  channelId: string
}

export interface AccountsConfig {
  /** Set Discord nicknames to the linked Minecraft name, with the team tag: "[RZ] Steve". */
  syncNicknames: boolean
}

export interface TeamsConfig {
  enabled: boolean
  /** Roles that create and manage teams with /teamadmin (MC Admin). */
  adminRoleIds: string[]
  /** Roles that can see every team's channels, to moderate them. */
  moderatorRoleIds: string[]
  /** New team roles are placed right above this role, so members are listed under their team. */
  placeRolesAboveRoleId: string
  inviteExpiryHours: number
  /** Hours of the day (0-23) when the in-game teams are resynced with Discord. */
  syncHours: number[]
}

export interface AuditLogConfig {
  /** Channel where every action taken through the bot is recorded. Leave blank to log to the console only. */
  channelId: string
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
  serverControl: RestrictedFeatureConfig
  operatorCommands: RestrictedFeatureConfig
  accounts: AccountsConfig
  teams: TeamsConfig
  auditLog: AuditLogConfig
}
