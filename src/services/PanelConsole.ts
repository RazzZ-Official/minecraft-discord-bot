import type { PanelClient } from './PanelClient.js'

// How long to collect the server's reply to a command that is read.
const REPLY_WAIT_MS = 1_200
// Gap between commands that are only sent, to keep their order without flooding the console.
const SEND_GAP_MS = 150
const CONNECT_TIMEOUT_MS = 10_000
// Strips terminal colour codes and the console prompt from output lines. Matching the escape character is the point.
// eslint-disable-next-line no-control-regex
const TERMINAL_CODES = /\u001b\[[0-9;?]*[A-Za-z]|\u001b[=>]|>\.\.\.\./g

interface SocketMessage {
  event: string
  args?: string[]
}

/** One live console connection. Many commands go through it with a single panel request. */
export class ConsoleSession {
  private readonly lines: string[] = []

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as SocketMessage
      if (message.event === 'console output' && message.args?.[0]) this.lines.push(clean(message.args[0]))
    })
  }

  /** Sends a command without reading its reply. */
  async send(command: string): Promise<void> {
    this.socket.send(JSON.stringify({ event: 'send command', args: [command] }))
    await sleep(SEND_GAP_MS)
  }

  /** Sends a command and returns the server's reply lines. */
  async run(command: string): Promise<string[]> {
    const start = this.lines.length
    this.socket.send(JSON.stringify({ event: 'send command', args: [command] }))
    await sleep(REPLY_WAIT_MS)
    return this.lines.slice(start).filter((line) => line && !line.includes('issued server command'))
  }

  close(): void {
    this.socket.close()
  }
}

/**
 * Opens live console connections through the panel. Used where the bot needs to read results (eg. listing
 * scoreboard teams) or send many commands at once without hitting the panel's request limit.
 */
export class PanelConsole {
  constructor(private readonly panel: PanelClient) {}

  /** Opens a session, runs `work` with it, and always closes it. */
  async withSession<T>(work: (session: ConsoleSession) => Promise<T>): Promise<T> {
    const session = await this.open()
    try {
      return await work(session)
    } finally {
      session.close()
    }
  }

  private async open(): Promise<ConsoleSession> {
    const { socket: url, token } = await this.panel.getConsoleCredentials()
    const socket = new WebSocket(url, { headers: { Origin: this.panel.origin } })
    const session = new ConsoleSession(socket)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error('The panel console did not respond.'))
      }, CONNECT_TIMEOUT_MS)
      socket.addEventListener('open', () => socket.send(JSON.stringify({ event: 'auth', args: [token] })))
      socket.addEventListener('message', (event: MessageEvent) => {
        if ((JSON.parse(String(event.data)) as SocketMessage).event !== 'auth success') return
        clearTimeout(timeout)
        resolve()
      })
      socket.addEventListener('error', () => {
        clearTimeout(timeout)
        reject(new Error('Could not connect to the panel console.'))
      })
    })
    return session
  }
}

// "[08:48:34 INFO]: Created team [Bot Test]" -> "Created team [Bot Test]"
const clean = (line: string): string =>
  line
    .replace(TERMINAL_CODES, '')
    .replace(/^.*?\[\d{2}:\d{2}:\d{2} [A-Z]+\]:\s*/, '')
    .trim()

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
