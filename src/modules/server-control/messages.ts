import type { PowerAction } from '../../services/PanelClient.js'

export const ServerControlText = {
  commands: {
    server: 'Control the Minecraft server. MC Admin only.',
    panel: 'Posts the server control panel in this channel.',
    status: 'Shows the server state, uptime and resource usage.',
    start: 'Starts the Minecraft server.',
    stop: 'Stops the Minecraft server.',
    restart: 'Restarts the Minecraft server.',
  },
  panel: {
    title: '🖥️ {name} Control Panel',
    description:
      'Manage the Minecraft server from Discord.\n\n▶️ **Start** the server\n🔁 **Restart** the server\n⏹️ **Stop** the server\n📊 **Status** shows uptime, CPU and memory\n\nEvery action asks for confirmation and is recorded in the logs.',
    footer: 'Only MC Admins can use these buttons.',
  },
  status: {
    title: '📊 Server Status',
    state: 'State',
    uptime: 'Uptime',
    players: 'Players',
    cpu: 'CPU',
    memory: 'Memory',
    disk: 'Disk',
  },
  confirm: '⚠️ **{action} the Minecraft server?** Players online will be disconnected.',
  confirmStart: '▶️ **Start the Minecraft server?**',
  working: '⏳ Sending **{action}** to the server...',
  done: '✅ **{action}** signal sent. The server panel takes it from here.',
  cancelled: '✖️ Cancelled.',
  failed: ':warning: **Could not {action} the server:** {error}',
  busy: ':hourglass: Another power action is already in progress.',
  noPermission: ':no_entry: Only MC Admins can control the server, in the server panel channel.',
  panelPosted: ':white_check_mark: Control panel posted in {channel}.',
} as const

export const ServerControlIds = {
  power: 'server:power',
  confirm: 'server:confirm',
  cancel: 'server:cancel',
  status: 'server:status',
} as const

export const POWER_ACTIONS: readonly PowerAction[] = ['start', 'restart', 'stop']

export const PowerLabels: Record<PowerAction, { label: string; emoji: string; verb: string }> = {
  start: { label: 'Start', emoji: '▶️', verb: 'Start' },
  restart: { label: 'Restart', emoji: '🔁', verb: 'Restart' },
  stop: { label: 'Stop', emoji: '⏹️', verb: 'Stop' },
}

export const isPowerAction = (value: string | undefined): value is PowerAction =>
  POWER_ACTIONS.includes(value as PowerAction)
