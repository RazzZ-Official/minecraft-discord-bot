// Sets up the Minecraft section of the Discord server: channel names, order and permissions, the MC Admin role,
// the staff channels, and removes the old Teams setup.
//
// Preview:  npm run discord:minecraft
// Apply:    npm run discord:minecraft -- --apply
import { ChannelType, OverwriteType, PermissionFlagsBits, REST, Routes } from 'discord.js'
import type {
  APIChannel,
  APIGuildChannel,
  APIRole,
  GuildChannelType,
  RESTPutAPIChannelPermissionJSONBody,
} from 'discord.js'
import { loadEnv } from '../config/env.js'

const GUILD_ID = '1285048482440286230'
const APPLY = process.argv.includes('--apply')

const ROLES = {
  everyone: GUILD_ID,
  top: '1429366850621538344',
  fam: '1429380790139224166',
  minecraft: '1446466000043380759',
  whitelistManager: '1558722619543396463',
}
const MC_ADMIN_ROLE = { name: 'MC Admin', color: 0xe74c3c, hoist: true }
const TEAM_ROLE_IDS = [
  '1556155832310431775',
  '1556155983854698537',
  '1556156055715582153',
  '1556156116898025483',
  '1556156206148751370',
  '1556156261119041557',
]
const BACKUP_CATEGORY_ID = '1502856857126174720'
const TEAM_INFO_CHANNEL_ID = '1429747534053638154'
const MINECRAFT_CATEGORY_ID = '1446467098166689812'

const P = PermissionFlagsBits
const READ = P.ViewChannel | P.ReadMessageHistory
const NO_CHAT = P.SendMessages | P.CreatePublicThreads | P.CreatePrivateThreads | P.SendMessagesInThreads

type Overwrite = { role: keyof typeof ROLES | 'mcAdmin'; allow?: bigint; deny?: bigint }
interface ChannelSpec {
  /** Existing channel ID, or undefined to create the channel. */
  id?: string
  name: string
  type: ChannelType.GuildText | ChannelType.GuildVoice
  overwrites: Overwrite[]
}

const hidden: Overwrite = { role: 'everyone', deny: P.ViewChannel }
const staffRead: Overwrite[] = [
  { role: 'whitelistManager', allow: READ, deny: NO_CHAT },
  { role: 'mcAdmin', allow: READ, deny: NO_CHAT },
]

// The Minecraft section, top to bottom. Text channels first, then voice, as Discord lists them.
const CATEGORY_NAME = '⛏️ »» 𝗠𝗜𝗡𝗘𝗖𝗥𝗔𝗙𝗧'
const CATEGORY_OVERWRITES: Overwrite[] = [hidden, { role: 'minecraft', allow: READ, deny: NO_CHAT }]
const CHANNELS: ChannelSpec[] = [
  {
    id: '1429367961210327124',
    name: '🌐・𝗜𝗽-𝗔𝗱𝗱𝗿𝗲𝘀𝘀',
    type: ChannelType.GuildText,
    overwrites: [hidden, { role: 'minecraft', allow: READ, deny: NO_CHAT }],
  },
  {
    id: '1429448173742719078',
    name: '📊・𝗦𝗲𝗿𝘃𝗲𝗿-𝗦𝘁𝗮𝘁𝘂𝘀',
    type: ChannelType.GuildText,
    overwrites: [hidden, { role: 'minecraft', allow: READ, deny: NO_CHAT }],
  },
  {
    id: '1558721889873043486',
    name: '📝・𝗪𝗵𝗶𝘁𝗲𝗹𝗶𝘀𝘁',
    type: ChannelType.GuildText,
    // Requests go through the panel button, so nobody needs to type here.
    overwrites: [
      hidden,
      { role: 'minecraft', allow: READ, deny: NO_CHAT },
      { role: 'fam', allow: READ, deny: NO_CHAT },
    ],
  },
  {
    id: '1446467189417967657',
    name: '💬・𝗠𝗰-𝗖𝗵𝗮𝘁',
    type: ChannelType.GuildText,
    overwrites: [hidden, { role: 'minecraft', allow: READ | P.SendMessages | P.SendMessagesInThreads }],
  },
  {
    id: '1558722136472948807',
    name: '🛡️・𝗪𝗵𝗶𝘁𝗲𝗹𝗶𝘀𝘁-𝗠𝗮𝗻𝗮𝗴𝗲',
    type: ChannelType.GuildText,
    overwrites: [
      hidden,
      { role: 'whitelistManager', allow: READ | P.SendMessages | P.UseApplicationCommands },
      { role: 'mcAdmin', allow: READ | P.SendMessages | P.UseApplicationCommands },
    ],
  },
  {
    id: '1558723180711911465',
    name: '📜・𝗗𝗰-𝗠𝗰-𝗟𝗼𝗴𝘀',
    type: ChannelType.GuildText,
    overwrites: [hidden, ...staffRead],
  },
  {
    name: '🖥️・𝗦𝗲𝗿𝘃𝗲𝗿-𝗣𝗮𝗻𝗲𝗹',
    type: ChannelType.GuildText,
    overwrites: [hidden, { role: 'mcAdmin', allow: READ | P.UseApplicationCommands, deny: NO_CHAT }],
  },
  {
    name: '⚔️・𝗠𝗰-𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀',
    type: ChannelType.GuildText,
    overwrites: [hidden, { role: 'top', allow: READ | P.SendMessages | P.UseApplicationCommands }],
  },
  {
    id: '1446467241796173835',
    name: '🔊・𝗠𝗰 𝗟𝗼𝗯𝗯𝘆',
    type: ChannelType.GuildVoice,
    overwrites: [hidden, { role: 'minecraft', allow: READ | P.Connect | P.Speak | P.SendMessages }],
  },
  {
    id: '1429367964909699224',
    name: '🔊・𝗠𝗰 𝗦𝗾𝘂𝗮𝗱 𝟭',
    type: ChannelType.GuildVoice,
    overwrites: [hidden, { role: 'minecraft', allow: READ | P.Connect | P.Speak | P.SendMessages }],
  },
  {
    id: '1431323450496253982',
    name: '🔊・𝗠𝗰 𝗦𝗾𝘂𝗮𝗱 𝟮',
    type: ChannelType.GuildVoice,
    overwrites: [hidden, { role: 'minecraft', allow: READ | P.Connect | P.Speak | P.SendMessages }],
  },
]

const rest = new REST().setToken(loadEnv().BOT_TOKEN)
const steps: string[] = []

/** Records a change, and only performs it with --apply. */
const change = async <T>(description: string, action: () => Promise<T>): Promise<T | undefined> => {
  steps.push(description)
  console.log(`${APPLY ? '✔' : '•'} ${description}`)
  return APPLY ? action() : undefined
}

const main = async (): Promise<void> => {
  console.log(APPLY ? 'Applying changes...\n' : 'Preview only. Nothing is changed. Run with --apply to apply.\n')
  const roles = (await rest.get(Routes.guildRoles(GUILD_ID))) as APIRole[]
  const channels = (await rest.get(Routes.guildChannels(GUILD_ID))) as APIGuildChannel<GuildChannelType>[]
  const byId = new Map(channels.map((channel) => [channel.id, channel]))

  // MC Admin role, placed right above Whitelist Manager.
  let mcAdmin = roles.find((role) => role.name === MC_ADMIN_ROLE.name)
  if (!mcAdmin) {
    mcAdmin = (await change(`Create role "${MC_ADMIN_ROLE.name}"`, () =>
      rest.post(Routes.guildRoles(GUILD_ID), { body: { ...MC_ADMIN_ROLE, permissions: '0', mentionable: false } })
    )) as APIRole | undefined
  }
  const whitelistManager = roles.find((role) => role.id === ROLES.whitelistManager)
  if (whitelistManager && mcAdmin && mcAdmin.position <= whitelistManager.position) {
    const adminId = mcAdmin.id
    await change(`Move "${MC_ADMIN_ROLE.name}" above "${whitelistManager.name}"`, () =>
      rest.patch(Routes.guildRoles(GUILD_ID), { body: [{ id: adminId, position: whitelistManager.position + 1 }] })
    )
  }
  const roleIds: Record<Overwrite['role'], string> = { ...ROLES, mcAdmin: mcAdmin?.id ?? '<new MC Admin role>' }

  // Remove the Teams setup.
  for (const id of TEAM_ROLE_IDS) {
    const role = roles.find((entry) => entry.id === id)
    if (role) await change(`Delete role "${role.name}"`, () => rest.delete(Routes.guildRole(GUILD_ID, id)))
  }
  const teamChannels = channels.filter((channel) => channel.parent_id === BACKUP_CATEGORY_ID)
  for (const channel of [...teamChannels, byId.get(BACKUP_CATEGORY_ID), byId.get(TEAM_INFO_CHANNEL_ID)]) {
    if (channel) await change(`Delete channel "${channel.name}"`, () => rest.delete(Routes.channel(channel.id)))
  }

  // Minecraft category and its channels.
  const toOverwrites = (overwrites: Overwrite[]): RESTPutAPIChannelPermissionJSONBody[] =>
    overwrites.map((overwrite) => ({
      id: roleIds[overwrite.role],
      type: OverwriteType.Role,
      allow: String(overwrite.allow ?? 0n),
      deny: String(overwrite.deny ?? 0n),
    }))
  const category = byId.get(MINECRAFT_CATEGORY_ID)
  if (!category) throw new Error('The Minecraft category was not found.')
  await change(`Rename category "${category.name}" -> "${CATEGORY_NAME}" and set its permissions`, () =>
    rest.patch(Routes.channel(category.id), {
      body: { name: CATEGORY_NAME, permission_overwrites: toOverwrites(CATEGORY_OVERWRITES) },
    })
  )

  const created: Record<string, string> = {}
  for (const [position, spec] of CHANNELS.entries()) {
    const existing = spec.id
      ? byId.get(spec.id)
      : channels.find((channel) => channel.parent_id === category.id && channel.name === spec.name)
    const body = {
      name: spec.name,
      position,
      parent_id: category.id,
      permission_overwrites: toOverwrites(spec.overwrites),
    }
    if (existing) {
      const rename = existing.name === spec.name ? `"${spec.name}"` : `"${existing.name}" -> "${spec.name}"`
      await change(`Update ${rename} (position ${position}, permissions)`, () =>
        rest.patch(Routes.channel(existing.id), { body })
      )
    } else {
      const channel = (await change(`Create "${spec.name}" (position ${position})`, () =>
        rest.post(Routes.guildChannels(GUILD_ID), { body: { ...body, type: spec.type } })
      )) as APIChannel | undefined
      if (channel) created[spec.name] = channel.id
    }
  }

  console.log(`\n${steps.length} changes${APPLY ? ' applied' : ' planned'}.`)
  if (APPLY) {
    console.log(`MC Admin role: ${roleIds.mcAdmin}`)
    for (const [name, id] of Object.entries(created)) console.log(`New channel ${name}: ${id}`)
  }
}

main().catch((error: unknown) => {
  console.error('Setup failed.', error)
  process.exit(1)
})
