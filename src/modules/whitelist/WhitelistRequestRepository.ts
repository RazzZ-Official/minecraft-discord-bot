import crypto from 'node:crypto'
import { mongo } from 'mongoose'
import type { PlayerIdentity } from './PlayerName.js'
import { CASE_INSENSITIVE, WhitelistRequestModel } from './WhitelistRequestModel.js'
import type { WhitelistRequest } from './WhitelistRequestModel.js'

const DUPLICATE_KEY_ERROR = 11000

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

export class WhitelistRequestRepository {
  findById(requestId: string): Promise<WhitelistRequest | null> {
    return WhitelistRequestModel.findOne({ requestId }).lean<WhitelistRequest>().exec()
  }

  findPendingByUser(userId: string): Promise<WhitelistRequest | null> {
    return WhitelistRequestModel.findOne({ userId, status: 'pending' }).lean<WhitelistRequest>().exec()
  }

  findPendingByName(whitelistName: string): Promise<WhitelistRequest | null> {
    return WhitelistRequestModel.findOne({ whitelistName, status: 'pending' })
      .collation(CASE_INSENSITIVE)
      .lean<WhitelistRequest>()
      .exec()
  }

  /** @throws DuplicatePendingRequestError when a pending request already exists for the user or name. */
  async create(request: NewRequest): Promise<WhitelistRequest> {
    try {
      const created = await WhitelistRequestModel.create({
        ...request,
        requestId: crypto.randomBytes(6).toString('hex'),
      })
      return created.toObject<WhitelistRequest>()
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === DUPLICATE_KEY_ERROR) {
        throw new DuplicatePendingRequestError()
      }
      throw error
    }
  }

  async setStaffMessage(requestId: string, staffMessageId: string): Promise<void> {
    await WhitelistRequestModel.updateOne({ requestId }, { staffMessageId })
  }

  async setNotified(requestId: string, notified: boolean): Promise<void> {
    await WhitelistRequestModel.updateOne({ requestId }, { notified })
  }

  async delete(requestId: string): Promise<void> {
    await WhitelistRequestModel.deleteOne({ requestId })
  }

  /** Records a decision, but only if the request is still pending. Returns null if it was already decided. */
  decide(requestId: string, decision: Decision): Promise<WhitelistRequest | null> {
    return WhitelistRequestModel.findOneAndUpdate(
      { requestId, status: 'pending' },
      { ...decision, reason: decision.reason ?? null, decidedAt: new Date() },
      { returnDocument: 'after' }
    )
      .lean<WhitelistRequest>()
      .exec()
  }
}
