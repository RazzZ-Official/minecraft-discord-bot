/** The 16 Minecraft team colours, with the matching Discord role colour. */
export const MINECRAFT_COLORS = {
  red: 0xff5555,
  dark_red: 0xaa0000,
  gold: 0xffaa00,
  yellow: 0xffff55,
  green: 0x55ff55,
  dark_green: 0x00aa00,
  aqua: 0x55ffff,
  dark_aqua: 0x00aaaa,
  blue: 0x5555ff,
  dark_blue: 0x0000aa,
  light_purple: 0xff55ff,
  dark_purple: 0xaa00aa,
  white: 0xffffff,
  gray: 0xaaaaaa,
  dark_gray: 0x555555,
  // Pure black means "no colour" for Discord roles, so use the closest visible black.
  black: 0x010101,
} as const

export type MinecraftColor = keyof typeof MINECRAFT_COLORS

export const COLOR_CHOICES = Object.keys(MINECRAFT_COLORS).map((color) => ({
  name: color.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
  value: color,
}))

export const isMinecraftColor = (value: string): value is MinecraftColor => value in MINECRAFT_COLORS

// Letters, digits, spaces, apostrophes and dashes; 3-24 characters, starting and ending with a letter or digit.
const TEAM_NAME = /^[A-Za-z0-9][A-Za-z0-9 '-]{1,22}[A-Za-z0-9]$/
const TEAM_TAG = /^[A-Z0-9]{2,4}$/
// Names of players as they appear on the scoreboard, eg. "Steve" or ".Connor_Leo2299".
const PLAYER_NAME = /^\.?[A-Za-z0-9_]{1,16}$/

// Mathematical sans-serif bold, the font used across the Discord server's channel names.
const BOLD_OFFSETS: [RegExp, number, number][] = [
  [/[A-Z]/, 0x41, 0x1d5d4],
  [/[a-z]/, 0x61, 0x1d5ee],
  [/[0-9]/, 0x30, 0x1d7ec],
]

export class TeamNames {
  static isValidName(name: string): boolean {
    return TEAM_NAME.test(name)
  }

  static isValidTag(tag: string): boolean {
    return TEAM_TAG.test(tag)
  }

  static isValidPlayer(name: string): boolean {
    return PLAYER_NAME.test(name)
  }

  static normalizeTag(tag: string): string {
    return tag.trim().toUpperCase()
  }

  /** The in-game scoreboard team for a tag, eg. "RZ" -> "team_rz". */
  static teamId(tag: string): string {
    return `team_${tag.toLowerCase()}`
  }

  static bold(text: string): string {
    return [...text]
      .map((char) => {
        const offset = BOLD_OFFSETS.find(([pattern]) => pattern.test(char))
        return offset ? String.fromCodePoint(offset[2] + char.charCodeAt(0) - offset[1]) : char
      })
      .join('')
  }

  static roleName(tag: string, name: string): string {
    return `[${tag}] ${name}`
  }

  static channelNames(tag: string, name: string): { category: string; chat: string; gallery: string; voice: string } {
    return {
      category: `🛡️ »» [${tag}] ${TeamNames.bold(name)}`,
      chat: `💬・${TeamNames.bold(`${tag}-Chat`)}`,
      gallery: `🖼️・${TeamNames.bold(`${tag}-Gallery`)}`,
      voice: `🔊・${TeamNames.bold(`${tag} VC`)}`,
    }
  }
}
