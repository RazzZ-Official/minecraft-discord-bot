import type { Edition } from '../config/types.js'
import { JsonStore } from '../core/JsonStore.js'

/** A Discord account linked to a Minecraft name, as stored in datas/account-links.json. */
export interface AccountLink {
  userId: string
  /** The name in whitelist.json, eg. "Steve" or ".Connor_Leo2299" for Bedrock. */
  minecraftName: string
  edition: Edition
  linkedAt: string
  /** Discord ID of the staff member who approved or linked it. */
  linkedBy: string
}

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** Links between Discord accounts and Minecraft names. Created when staff approve a whitelist request. */
export class AccountLinks {
  private readonly store = new JsonStore<AccountLink>('account-links')

  get(userId: string): AccountLink | null {
    return this.store.find((link) => link.userId === userId) ?? null
  }

  findByName(minecraftName: string): AccountLink | null {
    return this.store.find((link) => sameName(link.minecraftName, minecraftName)) ?? null
  }

  /** Links the user to the name. A name belongs to one account, so any older link to the same name is removed. */
  async link(link: Omit<AccountLink, 'linkedAt'>): Promise<AccountLink> {
    await this.store.remove(
      (existing) => existing.userId !== link.userId && sameName(existing.minecraftName, link.minecraftName)
    )
    return this.store.upsert((existing) => existing.userId === link.userId, {
      ...link,
      linkedAt: new Date().toISOString(),
    })
  }

  async unlinkByName(minecraftName: string): Promise<AccountLink | null> {
    const link = this.findByName(minecraftName)
    if (link) await this.store.remove((existing) => existing.userId === link.userId)
    return link
  }
}
