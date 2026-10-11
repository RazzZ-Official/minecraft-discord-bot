import type { Edition } from '../config/types.js'

const DEFAULT_JAVA_PORT = 25565

/** Replaces {placeholders} in a template, case-insensitively. Unknown placeholders are left as they are. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const entry = Object.entries(values).find(([name]) => name.toLowerCase() === key.toLowerCase())
    return entry ? String(entry[1]) : match
  })

/** "ip" for Java servers on the default port, otherwise "ip:port". */
export const formatAddress = (ip: string, port: number, edition: Edition): string =>
  edition === 'java' && port === DEFAULT_JAVA_PORT ? ip : `${ip}:${port}`

/** Turns a multi-line MOTD into a single line. */
export const singleLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** eg. "2d 4h 5m", "8h 36m 23s" or "4m 10s". */
export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor(totalSeconds / 3_600) % 24
  const minutes = Math.floor(totalSeconds / 60) % 60
  const seconds = totalSeconds % 60
  if (days) return `${days}d ${hours}h ${minutes}m`
  if (hours) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

export const editionName = (edition: Edition): string => (edition === 'bedrock' ? 'Bedrock' : 'Java')

/** Removes backticks so user input cannot break out of inline code in a message. */
export const stripBackticks = (text: string): string => text.replace(/`/g, '')
