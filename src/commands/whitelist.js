const { SlashCommandBuilder, MessageFlags, InteractionContextType } = require('discord.js')
const { whitelist, commands } = require('../../config')
const { cmdSlashTranslation, getError } = require('../index')
const { readWhitelist, removeFromWhitelist } = require('../whitelist/panel')
const { whitelistListMessage, editionName, entryEdition } = require('../whitelist/embeds')
const { logRemoval } = require('../whitelist/logger')
const { isStaff } = require('../whitelist/staff')

const text = cmdSlashTranslation.whitelist

// Autocomplete runs on every keystroke, so whitelist.json is cached briefly instead of read from the panel each time.
const AUTOCOMPLETE_CACHE_MS = 30_000
// Discord shows at most 25 autocomplete choices.
const AUTOCOMPLETE_LIMIT = 25
let autocompleteCache = { entries: [], fetchedAt: 0 }

const fillFields = (string, fields) =>
  string
    .replace(/\{username\}/gi, fields.username)
    .replace(/\{edition\}/gi, fields.edition ? editionName(fields.edition) : '')
    .replace(/\{staff\}/gi, fields.staff ?? '')
    .replace(/\{error\}/gi, fields.error ?? '')

// Returns the entries matching the input, case-insensitively. Bedrock gamertags may be typed without the prefix or with
// spaces. An exact (case-sensitive) match is listed first.
const findEntries = (entries, input) => {
  const name = input.trim()
  const bedrockName = `.${name.replace(/^\.+/, '').replace(/ /g, '_')}`
  const isExact = (entry) => entry.name === name || entry.name === bedrockName
  return entries
    .filter((entry) => [name, bedrockName].some((candidate) => candidate.toLowerCase() === entry.name?.toLowerCase()))
    .sort((a, b) => Number(isExact(b)) - Number(isExact(a)))
}

const handleList = async (interaction) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  try {
    const entries = await readWhitelist()
    if (!entries.length) {
      await interaction.editReply(text.replies.listEmpty)
      return
    }
    await interaction.editReply(whitelistListMessage(entries))
  } catch (error) {
    await interaction.editReply(text.replies.panelError).catch(() => {})
    getError(error, 'whitelistPanel')
  }
}

// The reply is public so other staff in the channel can see who removed whom.
const handleRemove = async (interaction, client) => {
  await interaction.deferReply()
  const input = interaction.options.getString('username')
  try {
    const matches = findEntries(await readWhitelist(), input)
    const [entry] = matches
    if (!entry) {
      await interaction.editReply(fillFields(text.replies.removeNotFound, { username: input.replace(/`/g, '') }))
      return
    }
    // Java entries are removed by name, which the server resolves case-insensitively, so names that differ only in
    // capitalisation (eg. "boxick" and "Boxick") could remove the wrong player.
    if (entryEdition(entry) === 'java' && matches.filter((match) => entryEdition(match) === 'java').length > 1) {
      await interaction.editReply(fillFields(text.replies.removeAmbiguous, { username: entry.name }))
      return
    }

    let failure
    try {
      const confirmed = await removeFromWhitelist(entry)
      if (!confirmed) failure = fillFields(text.replies.removeNotVerified, { username: entry.name })
    } catch (error) {
      failure = error.message
      getError(error, 'whitelistPanel')
    }
    if (failure) {
      await interaction.editReply(fillFields(text.replies.removeFailed, { username: entry.name, error: failure }))
      return
    }

    autocompleteCache.fetchedAt = 0
    await interaction.editReply(
      fillFields(text.replies.removed, {
        username: entry.name,
        edition: entryEdition(entry),
        staff: `<@${interaction.user.id}>`,
      })
    )
    await logRemoval(client, entry, interaction.user)
  } catch (error) {
    await interaction.editReply(text.replies.panelError).catch(() => {})
    getError(error, 'whitelistPanel')
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName(text.name)
    .setDescription(text.description)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) => subcommand.setName(text.list.name).setDescription(text.list.description))
    .addSubcommand((subcommand) =>
      subcommand
        .setName(text.remove.name)
        .setDescription(text.remove.description)
        .addStringOption((option) =>
          option
            .setName('username')
            .setDescription(text.remove.username)
            .setRequired(true)
            .setMaxLength(32)
            .setAutocomplete(true)
        )
    ),
  run: async ({ interaction, client }) => {
    const subcommand = interaction.options.getSubcommand()
    // Players request access through the /setwhitelist panel. These subcommands are staff-only and only work in the
    // staff channel.
    if (!isStaff(interaction)) {
      interaction.reply({ content: text.replies.notStaff, flags: MessageFlags.Ephemeral })
      return
    }
    if (subcommand === text.list.name) await handleList(interaction)
    else if (subcommand === text.remove.name) await handleRemove(interaction, client)
  },
  autocomplete: async ({ interaction }) => {
    // Whitelisted names are only suggested to staff.
    if (!isStaff(interaction)) {
      await interaction.respond([])
      return
    }
    try {
      if (Date.now() - autocompleteCache.fetchedAt > AUTOCOMPLETE_CACHE_MS) {
        autocompleteCache = { entries: await readWhitelist(), fetchedAt: Date.now() }
      }
      const focused = interaction.options.getFocused().toLowerCase()
      const choices = autocompleteCache.entries
        .map((entry) => entry.name)
        .filter((name) => typeof name === 'string' && name.toLowerCase().includes(focused))
        .slice(0, AUTOCOMPLETE_LIMIT)
        .map((name) => ({ name, value: name }))
      await interaction.respond(choices)
    } catch (error) {
      await interaction.respond([]).catch(() => {})
      getError(error, 'whitelistPanel')
    }
  },
  options: {
    deleted: !whitelist.enabled || !commands.slashCommands, // Deletes the command from Discord
  },
}
