export const GeneralText = {
  help: {
    description: 'Sends the list of available commands.',
    optionDescription: 'Sends the details about a command.',
    title: '__**COMMANDS LIST**__',
    prefixLine: '**Prefix: `{prefix}`**',
    listItem: '{mention} **`-` {description}**',
    detailTitle: '__**{name} Command**__',
    detail:
      '**Slash command: {mention}\nDescription: `{description}`\nPrefix command: `{prefixCommand}`\nPrefix aliases: {aliases}**',
    noAliases: 'none',
  },
  info: {
    description: 'Sends the current information about the bot.',
    title: '**Bot Info and Stats**',
    body: '**CPU usage: `{cpu}%`\nMemory usage: `{memory}MB`\nNode.js version: `{node}`\nBot uptime: `{uptime}`\nPing: Client `{ping}ms` | Websocket `{websocket}ms`**',
  },
} as const
