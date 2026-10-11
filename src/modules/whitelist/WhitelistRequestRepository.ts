import crypto from 'node:crypto'
import { JsonStore } from '../../core/JsonStore.js'
import type { PlayerIdentity } from './PlayerName.js'
import type { WhitelistRequest } from './WhitelistRequest.js'

/** Thrown when the user or the name already has a pending request. */
export class DuplicatePendingRequestError extends Error {
  constructor() {
    super('A pending request already exists for this user or name.')
    this.name = 'DuplicatePendingRequestError'
  }
}

export interface NewRequest extends PlayerIdentity {
  userId: string
  userTag: string
}

export interface Decision {
  status: 'approved' | 'rejected'
  decidedBy: string
  reason?: string | null
}

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** Whitelist requests in datas/whitelist-requests.json. */
export class WhitelistRequestRepository {
  private readonly store = new JsonStore<WhitelistRequest>('whitelist-requests')

  findById(requestId: string): WhitelistRequest | null {
    return this.store.find((request) => request.requestId === requestId) ?? null
  }

  approved(): WhitelistRequest[] {
    return this.store.filter((request) => request.status === 'approved')
  }

  findPendingByUser(userId: string): WhitelistRequest | null {
    return this.store.find((request) => request.status === 'pending' && request.userId === userId) ?? null
  }

  findPendingByName(whitelistName: string): WhitelistRequest | null {
    return (
      this.store.find((request) => request.status === 'pending' && sameName(request.whitelistName, whitelistName)) ??
      null
    )
  }

  /**
   * One pending request per user and per name: the check and the insert happen together in memory, so two requests
   * at the same moment cannot both get through.
   * @throws DuplicatePendingRequestError when a pending request already exists for the user or name.
   */
  create(request: NewRequest): Promise<WhitelistRequest> {
    if (this.findPendingByUser(request.userId) || this.findPendingByName(request.whitelistName)) {
      return Promise.reject(new DuplicatePendingRequestError())
    }
    const now = new Date().toISOString()
    return this.store.insert({
      ...request,
      requestId: crypto.randomBytes(6).toString('hex'),
      status: 'pending',
      staffMessageId: null,
      reason: null,
      decidedBy: null,
      decidedAt: null,
      notified: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  async setStaffMessage(requestId: string, staffMessageId: string): Promise<void> {
    await this.store.update((request) => request.requestId === requestId, { staffMessageId, updatedAt: now() })
  }

  async setNotified(requestId: string, notified: boolean): Promise<void> {
    await this.store.update((request) => request.requestId === requestId, { notified, updatedAt: now() })
  }

  async delete(requestId: string): Promise<void> {
    await this.store.remove((request) => request.requestId === requestId)
  }

  /** Records a decision, but only if the request is still pending. Returns null if it was already decided. */
  async decide(requestId: string, decision: Decision): Promise<WhitelistRequest | null> {
    const decidedAt = now()
    const updated = await this.store.update(
      (request) => request.requestId === requestId && request.status === 'pending',
      {
        ...decision,
        reason: decision.reason ?? null,
        decidedAt,
        updatedAt: decidedAt,
      }
    )
    return updated ?? null
  }
}

const now = (): string => new Date().toISOString()
