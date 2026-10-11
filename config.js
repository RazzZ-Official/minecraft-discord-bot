// Config Documentation: https://nooberpro.gitbook.io/minecraft-discord-bot/installation/config
// "MC" refers to Minecraft in the comments for convenience.
require("dotenv").config();
module.exports = {
  bot: {
    token: process.env.BOT_TOKEN,
    // Automatically updates the bot's status and activity.
    presence: {
      enabled: true,
      activity: "Playing", // Options: Playing, Listening, Watching, Competing.
      text: {
        online: "with {playeronline}/{playermax} players", // {playeronline} and {playermax} display the current and maximum number of players.
        offline: "Server Offline", // Status text when the server is offline.
      },
      status: {
        // Options: online, idle, dnd, invisible.
        online: "online", // Bot status when the MC server is online.
        offline: "idle", // Bot status when the MC server is offline.
      },
    },
  },
  mcserver: {
    ip: "mc.razzz.in", // IP address of the MC server.
    port: 25598, // Port number of the MC server. Use Query Port in Java for the full player list.
    type: "java", // Type of MC server: "java" or "bedrock".
    name: "RazzZ SMP V3", // Name of the MC server.
    version: "Requires 1.20 - 1.26.3", // Version of the MC server.
    // Direct image URL of the MC server logo, shown on the bot's embeds (eg. an Imgur i.imgur.com link).
    // Discord attachment links expire, so do not use them here. The logo file is saved in assets/server-logo.png.
    icon: "https://i.imgur.com/6Msem8Q.png",
    site: "https://razzz.in", // URL of the MC server or vote website. Leave blank to disable site commands.
  },

  // Bot settings.
  settings: {
    language: {
      // Only English is available: en (English). The texts can be edited in ./translation/en/.
      main: "en", // Main language (files in ./translation/)
      // Optional language settings for specific features. Leave blank to use the main language.
      embeds: "", // Language for embeds, Slash and Prefix Commands, Auto Changing Status.
      autoReply: "", // Language for auto-reply feature responses.
      consoleLog: "", // Language for console log output.
      slashCmds: "", // Language for slash commands descriptions and error messages.
    },
    embedsColors: {
      basicCmds: "Aqua", // Color for basic commands like version, site, ip.
      online: "Green", // Color for commands when the server is online (e.g., status, players, motd).
      offline: "Red", // Color for offline status embeds.
    },
    // Console logging settings.
    logging: {
      timezone: "", // Time zone for the bot. Use formats like America/New_York or Europe/London. Leave blank to use the bot's local time zone.
      inviteLink: true, // Log the invite link at the bot's launch.
      debug: false, // Log status messages and bot activity updates (may result in spam).
      error: true, // Log any errors that occur.
      serverInfo: true, // Log basic server info and check if it's online at startup.
    },
  },

  // Feature settings

  // Automatically updates the MC server status in a channel in real-time.
  autoChangeStatus: {
    enabled: true,
    updateInterval: 60, // Interval between status updates in seconds. Recommended: above 60.
    adminOnly: true, // It makes admins who with the "Manage Channel" permission can only set the status message.
    banner: "./assets/serverinfo-banner.gif", // Image at the bottom of the status message: a local file path or an image URL. Leave blank to disable.
    // These settings apply to slash (/) and prefix commands for status.
    isOnlineCheck: true, // Useful for servers using free hosting providers like Aternos. If the server's max players is 0, the status will be set to offline.
  },

  // Shows the player count of the MC server in the channel name.
  playerCountCH: {
    enabled: true,
    guildID: "1285048482440286230", // Server ID for creating/editing channel stats.
    channelId: "", // Channel ID for editing the player count. If no ID is provided, the bot will create the channel itself.
    // {playeronline} and {playermax} display the current and maximum number of players.
    onlineText: "🟢 {playeronline}/{playermax} active players",
    offlineText: "🔴 Offline", // Name set when the MC server is offline.
  },

  autoReply: {
    // If a message contains trigger words, reply with appropriate server information.
    enabled: true, // Disable the entire auto-reply feature.
    deleteMsg: false, // This will delete the trigger message sent by user and response of the bot after 10 sec. (Avoids clutter in chat)
    // Channels where auto-reply are enabled. eg: ['1234567','8909876',].  The number given here is channel's id.
    enabledChannels: [],
    // Channels where auto-reply are disabled. eg: ['1234567','8909876',]. The number given here is channel's id.
    disabledChannels: [],
    version: {
      enabled: true,
      triggerWords: ["version of the server?", "version"],
    },
    ip: {
      enabled: true,
      triggerWords: ["ip of the server", "ip"],
    },
    site: {
      enabled: true,
      triggerWords: [
        "website link",
        "website",
        "url",
        "site",
        "vote url",
        "link",
      ],
    },
    status: {
      enabled: true,
      triggerWords: [
        "is server online?",
        "is server offline",
        "status of the server",
      ],
    },
  },

  // Server info card sent by the serverinfo command. Texts are in the translation files (embeds.json5 > serverInfo).
  // The Java address (mcserver.ip) and the live MOTD are taken from the mcserver settings above.
  serverInfo: {
    bedrockPort: 25593, // Bedrock (Geyser) port, shown as mcserver.ip:bedrockPort.
    color: "#2ECC71", // Color of the card's side bar.
    banner: "./assets/serverinfo-banner.gif", // Image at the bottom of the card: a local file path or an image URL. Leave blank to disable.
    // Who is pinged above the card: "everyone", "here", a role ID, or "" for no ping.
    // Only members with the "Mention @everyone, @here and All Roles" permission can make the bot ping.
    mention: "everyone",
  },

  // Players request access with /whitelist request, and staff approve or reject it in a private channel.
  // Approved players are added through the hosting panel API (see panel below). Bedrock players use Floodgate's fwhitelist.
  whitelist: {
    enabled: true,
    staffChannelId: "1558722136472948807", // Private channel where requests are posted with Approve and Reject buttons.
    logChannelId: "1558723180711911465", // Channel for decision logs. Leave blank to log decisions only to the console.
    // Roles allowed to approve or reject requests. eg: ['1234567','8909876',]. If empty, only Administrators can.
    staffRoleIds: ["1558722619543396463"],
    // Channels where /whitelist request can be used. eg: ['1234567','8909876',]. Leave empty to allow all channels.
    requestChannels: ["1558721889873043486"],
  },

  // Hosting panel (Pterodactyl / Reviactyl) used by the whitelist feature and the status message uptime.
  // Credentials are read from the .env file. Never put them directly in this file.
  panel: {
    url: process.env.PTERO_PANEL_URL, // eg: https://gp.hector.host
    serverId: process.env.PTERO_SERVER_ID, // The short server ID from the panel URL, eg: b0b9a9bf
    apiKey: process.env.PTERO_API_KEY, // Client API key from Account > API Credentials.
  },

  commands: {
    slashCommands: true, // Enables all slash commands.
    // Channels where slash and prefix commands are enabled. eg: ['1234567','8909876',].  The number given here is channel's id.
    enabledChannels: [],
    // Channels where slash and prefix commands are disabled. eg: ['1234567','8909876',]. The number given here is channel's id.
    disabledChannels: [],
    prefixCommands: {
      enabled: true, // Enables all prefix commands.
      prefix: "!", // Prefix for normal commands.
    },
    serverinfo: {
      enabled: true, // Enables the server info command.
      alias: ["server", "join"], // Aliases for server info prefix commands.
    },
    ip: {
      enabled: true, // Enables the IP command.
      alias: ["ip-address"], // Aliases for IP prefix commands.
    },
    site: {
      enabled: true, // Enables the site command.
      alias: ["vote", "link"], // Aliases for site prefix commands.
    },
    version: {
      enabled: true, // Enables the version command.
      alias: [], // Aliases for version prefix commands.
    },
    players: {
      enabled: true, // Enables the players command.
      alias: ["plist"], // Aliases for players prefix commands.
    },
    status: {
      enabled: true, // Enables the status command.
      alias: [], // Aliases for status prefix commands.
    },
    motd: {
      enabled: true, // Enables the motd command.
      alias: [], // Aliases for motd prefix commands.
    },
    help: {
      enabled: true, // Enables the help command.
      alias: ["commands"], // Aliases for help prefix commands.
    },
  },
};
