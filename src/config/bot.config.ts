import type { BotConfig } from './types.js'

// Bot settings. Secrets (bot token, panel key, database URL) live in the .env file instead.
// Rebuild the bot (npm run build) after changing this file.
export const botConfig: BotConfig = {
  // The Minecraft server. Every command, status message and info card reads the address from here.
  server: {
    name: 'RazzZ SMP V3',
    ip: 'mc.razzz.in',
    port: 25598, // Java and Geyser (Bedrock) share this port.
    edition: 'java',
    version: 'Requires 1.20 - 1.26.3',
    // Direct image URL of the server logo. Discord attachment links expire, so do not use them here.
    icon: 'https://raw.githubusercontent.com/RazzZ-Official/minecraft-discord-bot/c6ca34730c0c48567d639d5973e0630b70fbef7e/assets/server-logo.png',
    site: 'https://razzz.in', // Leave blank to disable the site command and auto-reply.
    zeroMaxPlayersMeansOffline: true,
  },

  // The bot's own Discord status. {playeronline} and {playermax} show the player count.
  presence: {
    enabled: true,
    activity: 'Playing',
    text: { online: 'with {playeronline}/{playermax} players', offline: 'Server Offline' },
    status: { online: 'online', offline: 'idle' },
  },

  logging: {
    timezone: '', // eg. Asia/Kolkata. Leave blank to use this machine's time zone.
    inviteLink: true, // Print the bot invite link at startup.
    debug: false, // Print every status and presence update.
    serverInfoOnStartup: true, // Print the server's status at startup.
  },

  colors: { basic: 'Aqua', online: 'Green', offline: 'Red' },

  commands: {
    slashCommands: true,
    prefix: { enabled: true, prefix: '!' },
    // Channels where the public info commands work. eg. ['1234567']. Empty means all channels.
    enabledChannels: [],
    disabledChannels: [],
    serverinfo: { enabled: true, aliases: ['server', 'join'] },
    ip: { enabled: true, aliases: ['ip-address'] },
    site: { enabled: true, aliases: ['vote', 'link'] },
    version: { enabled: true, aliases: [] },
    players: { enabled: true, aliases: ['plist'] },
    status: { enabled: true, aliases: [] },
    motd: { enabled: true, aliases: [] },
    help: { enabled: true, aliases: ['commands'] },
  },

  // Live status message created with /setstatus.
  statusCard: {
    enabled: true,
    updateIntervalSeconds: 60,
    adminOnly: true, // Only members with "Manage Channels" can use /setstatus.
    banner: './assets/serverinfo-banner.gif', // Local file or image URL. Leave blank to disable.
    // "everyone", "here", a role ID, or "" for none. Pings once when the message is created, and only if the member
    // running /setstatus may mention everyone.
    mention: 'everyone',
  },

  // Voice channel whose name shows the player count.
  playerCountChannel: {
    enabled: true,
    guildId: '1285048482440286230',
    channelId: '', // Leave blank to let the bot create the channel.
    onlineText: '🟢 {playeronline}/{playermax} active players',
    offlineText: '🔴 Offline',
  },

  // Replies to messages containing trigger words.
  autoReply: {
    enabled: true,
    deleteAfterSeconds: 0, // Delete the trigger message and the reply after this many seconds. 0 keeps them.
    enabledChannels: [],
    disabledChannels: [],
    version: { enabled: true, triggerWords: ['version of the server?', 'version'] },
    ip: { enabled: true, triggerWords: ['ip of the server', 'ip'] },
    site: { enabled: true, triggerWords: ['website link', 'website', 'url', 'site', 'vote url', 'link'] },
    status: { enabled: true, triggerWords: ['is server online?', 'is server offline', 'status of the server'] },
  },

  // Card sent by /serverinfo.
  serverInfo: {
    color: '#2ECC71',
    banner: './assets/serverinfo-banner.gif',
    // Only members who may mention everyone make the bot ping.
    mention: 'everyone',
  },

  // Whitelist requests through the /setwhitelist panel, reviewed by staff.
  whitelist: {
    enabled: true,
    staffChannelId: '1558722136472948807', // Private channel for requests and /whitelist list|remove.
    logChannelId: '1558723180711911465', // Decision log channel. Leave blank to log to the console only.
    staffRoleIds: ['1558722619543396463'], // If empty, only Administrators count as staff.
    banner: './assets/serverinfo-banner.gif',
  },
}
