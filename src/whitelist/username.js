// Java usernames: 3-16 letters, numbers and underscores.
const JAVA_USERNAME = /^[A-Za-z0-9_]{3,16}$/
// Xbox gamertags: letters and numbers separated by single spaces.
const BEDROCK_GAMERTAG = /^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/
// Floodgate rejects names longer than 16 characters.
const BEDROCK_MAX_LENGTH = 16

// Must match username-prefix and replace-spaces in plugins/floodgate/config.yml.
const FLOODGATE_PREFIX = '.'
// Floodgate UUIDs are the player's XUID with the first 64 bits set to zero.
const FLOODGATE_UUID = /^00000000-0000-0000-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates a player-supplied name and returns the details needed to whitelist it.
 * @returns {{ edition: 'java' | 'bedrock', username: string, whitelistName: string } | null}
 */
const parsePlayer = (edition, rawName) => {
  const input = rawName.trim()

  if (edition === 'java') {
    if (!JAVA_USERNAME.test(input)) return null
    return { edition, username: input, whitelistName: input }
  }

  if (edition === 'bedrock') {
    // Players usually copy the in-game name (".Connor_Leo2299"), so drop the prefix and turn underscores back into
    // spaces. Gamertags cannot contain underscores, so this always recovers the real gamertag.
    const gamertag = input.replace(/^\.+/, '').replace(/_/g, ' ')
    if (gamertag.length > BEDROCK_MAX_LENGTH || !BEDROCK_GAMERTAG.test(gamertag)) return null
    return { edition, username: gamertag, whitelistName: FLOODGATE_PREFIX + gamertag.replace(/ /g, '_') }
  }

  return null
}

/**
 * Works out how to remove an existing whitelist.json entry. Bedrock entries are removed by their Floodgate UUID, which
 * avoids a gamertag lookup. Returns null for entries whose name or UUID is not safe to send to the console.
 * @returns {{ edition: 'java' | 'bedrock', identifier: string } | null}
 */
const parseWhitelistEntry = (entry) => {
  if (typeof entry?.name !== 'string' || typeof entry?.uuid !== 'string') return null
  if (FLOODGATE_UUID.test(entry.uuid)) return { edition: 'bedrock', identifier: entry.uuid }
  if (JAVA_USERNAME.test(entry.name)) return { edition: 'java', identifier: entry.name }
  return null
}

/** Whether a player joined through Geyser/Floodgate, based on their UUID or the Floodgate name prefix. */
const isFloodgatePlayer = ({ uuid, name }) =>
  FLOODGATE_UUID.test(uuid ?? '') || (typeof name === 'string' && name.startsWith(FLOODGATE_PREFIX))

module.exports = { parsePlayer, parseWhitelistEntry, isFloodgatePlayer }
