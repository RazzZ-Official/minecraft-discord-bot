import type { Edition } from '../../config/types.js'

/** A validated player, ready to be whitelisted. */
export interface PlayerIdentity {
  edition: Edition
  /** Java username, or the Xbox gamertag (with spaces) for Bedrock. */
  username: string
  /** The name in whitelist.json, eg. "Steve" or ".Connor_Leo2299" for Bedrock. */
  whitelistName: string
}

/** An entry of the server's whitelist.json. */
export interface WhitelistEntry {
  name: string
  uuid: string
}

// Java usernames: 3-16 letters, numbers and underscores.
const JAVA_USERNAME = /^[A-Za-z0-9_]{3,16}$/
// Xbox gamertags: letters and numbers separated by single spaces. Floodgate rejects names over 16 characters.
const BEDROCK_GAMERTAG = /^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/
const BEDROCK_MAX_LENGTH = 16
// Must match username-prefix and replace-spaces in plugins/floodgate/config.yml.
const FLOODGATE_PREFIX = '.'
// Floodgate UUIDs are the player's XUID with the first 64 bits set to zero.
const FLOODGATE_UUID = /^00000000-0000-0000-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validates player names and maps them to whitelist entries. */
export class PlayerName {
  /** Returns null when the name is not valid for the edition. */
  static parse(edition: Edition, input: string): PlayerIdentity | null {
    const trimmed = input.trim()
    if (edition === 'java') {
      return JAVA_USERNAME.test(trimmed) ? { edition, username: trimmed, whitelistName: trimmed } : null
    }

    // Players often copy their in-game name (".Connor_Leo2299"), so drop the prefix and turn underscores back into
    // spaces. Gamertags cannot contain underscores, so this always recovers the real gamertag.
    const gamertag = trimmed.replace(/^\.+/, '').replace(/_/g, ' ')
    if (gamertag.length > BEDROCK_MAX_LENGTH || !BEDROCK_GAMERTAG.test(gamertag)) return null
    return { edition, username: gamertag, whitelistName: FLOODGATE_PREFIX + gamertag.replace(/ /g, '_') }
  }

  /**
   * How to remove an existing entry: Bedrock entries by their Floodgate UUID (no gamertag lookup needed), Java entries
   * by name. Returns null when the entry is not safe to send to the console.
   */
  static removalTarget(entry: WhitelistEntry): { edition: Edition; identifier: string } | null {
    if (FLOODGATE_UUID.test(entry.uuid)) return { edition: 'bedrock', identifier: entry.uuid }
    if (JAVA_USERNAME.test(entry.name)) return { edition: 'java', identifier: entry.name }
    return null
  }

  /** The edition of a whitelist entry. */
  static entryEdition(entry: WhitelistEntry): Edition {
    return FLOODGATE_UUID.test(entry.uuid) ? 'bedrock' : 'java'
  }

  /** The candidate whitelist names for staff input, eg. "Connor Leo2299" also matches ".Connor_Leo2299". */
  static candidates(input: string): string[] {
    const name = input.trim()
    return [name, `${FLOODGATE_PREFIX}${name.replace(/^\.+/, '').replace(/ /g, '_')}`]
  }
}

/** Whether an online player joined through Geyser/Floodgate, based on their UUID or the name prefix. */
export const isFloodgatePlayer = (player: { name: string; uuid: string | undefined }): boolean =>
  FLOODGATE_UUID.test(player.uuid ?? '') || player.name.startsWith(FLOODGATE_PREFIX)
