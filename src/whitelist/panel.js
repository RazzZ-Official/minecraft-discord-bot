// Whitelist operations on the hosting panel. Uses only the client API routes verified against the panel: server
// console commands and reading whitelist.json. Only whitelist add/remove commands can be sent through this module.
const { request, PanelError } = require('../panel')
const { parsePlayer, parseWhitelistEntry } = require('./username')

// Commands run asynchronously on the server, so whitelist.json is polled to confirm the change.
const VERIFY_ATTEMPTS = 6
const VERIFY_DELAY_MS = 1_500

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const readWhitelist = async () => {
  const response = await request('/files/contents?file=%2Fwhitelist.json')
  const entries = JSON.parse(await response.text())
  return Array.isArray(entries) ? entries : []
}

const waitUntil = async (check) => {
  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
    await sleep(VERIFY_DELAY_MS)
    if (await check()) return true
  }
  return false
}

const isWhitelisted = async (whitelistName) => {
  const target = whitelistName.toLowerCase()
  return (await readWhitelist()).some((entry) => entry.name?.toLowerCase() === target)
}

/**
 * Adds a player to the whitelist and waits until the entry appears in whitelist.json.
 * @returns {Promise<boolean>} Whether the entry was confirmed.
 */
const addToWhitelist = async (edition, username) => {
  // Re-validate here so that nothing except a checked name can ever reach the server console.
  const player = parsePlayer(edition, username)
  if (!player || player.username !== username) throw new PanelError(`Refusing to whitelist invalid name "${username}"`)

  // Floodgate parses the name as a quoted string, which allows gamertags with spaces. Quotes are rejected by parsePlayer.
  const command = edition === 'bedrock' ? `fwhitelist add "${player.username}"` : `whitelist add ${player.username}`
  await request('/command', { method: 'POST', body: { command } })
  return waitUntil(() => isWhitelisted(player.whitelistName))
}

/**
 * Removes an entry read from whitelist.json and waits until it is gone.
 * @returns {Promise<boolean>} Whether the removal was confirmed.
 */
const removeFromWhitelist = async (entry) => {
  const target = parseWhitelistEntry(entry)
  if (!target) throw new PanelError(`Refusing to remove unsupported whitelist entry "${entry?.name}"`)

  const command =
    target.edition === 'bedrock' ? `fwhitelist remove ${target.identifier}` : `whitelist remove ${target.identifier}`
  await request('/command', { method: 'POST', body: { command } })
  return waitUntil(async () => {
    const entries = await readWhitelist()
    return !entries.some((current) => current.uuid === entry.uuid)
  })
}

module.exports = { addToWhitelist, removeFromWhitelist, readWhitelist, isWhitelisted, PanelError }
