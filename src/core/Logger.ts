import chalk from 'chalk'
import type { LoggingConfig } from '../config/types.js'

type LoggerOptions = Pick<LoggingConfig, 'timezone' | 'debug'>

/** Console logger with timestamps and an optional scope, eg. "12 Oct, 1:25 PM | INFO  | [whitelist] message". */
export class Logger {
  constructor(
    private readonly options: LoggerOptions,
    private readonly scope?: string
  ) {}

  /** Returns a logger that prefixes every message with the given scope. */
  child(scope: string): Logger {
    return new Logger(this.options, scope)
  }

  info(message: string): void {
    console.log(this.format(chalk.cyan('INFO '), message))
  }

  warn(message: string): void {
    console.warn(this.format(chalk.yellow('WARN '), message))
  }

  error(message: string, error?: unknown): void {
    console.error(this.format(chalk.red('ERROR'), message))
    if (error !== undefined) console.error(error)
  }

  debug(message: string): void {
    if (this.options.debug) console.log(this.format(chalk.gray('DEBUG'), message))
  }

  private format(level: string, message: string): string {
    const scope = this.scope ? `${chalk.magenta(`[${this.scope}]`)} ` : ''
    return `${chalk.gray(this.timestamp())} | ${level} | ${scope}${message}`
  }

  private timestamp(): string {
    return new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      ...(this.options.timezone ? { timeZone: this.options.timezone } : {}),
    })
  }
}
