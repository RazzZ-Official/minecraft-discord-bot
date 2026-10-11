import type { Edition } from '../../config/types.js'
import { JsonStore } from '../../core/JsonStore.js'

/** A live status message created with /setstatus, as stored in datas/status-messages.json. */
export interface StatusMessage {
  messageId: string
  channelId: string
  guildId: string
  name: string
  ip: string
  port: number
  edition: Edition
  /** Mention saved when the message was created ("everyone", a role ID, or ""). Kept visible on every edit. */
  mention: string
  createdAt: string
}

export class StatusMessageRepository {
  private readonly store = new JsonStore<StatusMessage>('status-messages')

  all(): readonly StatusMessage[] {
    return this.store.all()
  }

  async add(message: Omit<StatusMessage, 'createdAt'>): Promise<void> {
    await this.store.insert({ ...message, createdAt: new Date().toISOString() })
  }

  async remove(messageId: string): Promise<void> {
    await this.store.remove((message) => message.messageId === messageId)
  }
}
