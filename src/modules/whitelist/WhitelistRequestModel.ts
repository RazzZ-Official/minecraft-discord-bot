import { Schema, model } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

// Case-insensitive comparison, so "Steve" and "steve" count as the same name.
export const CASE_INSENSITIVE = { locale: 'en', strength: 2 } as const

const whitelistRequestSchema = new Schema(
  {
    /** Short ID used in the staff message buttons, eg. "whitelist:approve:3f2a1b9c0d4e". */
    requestId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    userTag: { type: String, required: true },
    edition: { type: String, enum: ['java', 'bedrock'] as const, required: true },
    username: { type: String, required: true },
    whitelistName: { type: String, required: true },
    status: { type: String, enum: REQUEST_STATUSES, default: 'pending', required: true },
    staffMessageId: { type: String, default: null },
    reason: { type: String, default: null },
    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    /** Whether the player received the decision by DM. */
    notified: { type: Boolean, default: null },
  },
  { timestamps: true }
)

// One pending request per Discord user and per whitelist name, enforced by the database.
whitelistRequestSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } })
whitelistRequestSchema.index(
  { whitelistName: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, collation: CASE_INSENSITIVE }
)

export type WhitelistRequest = InferSchemaType<typeof whitelistRequestSchema> & { createdAt: Date }

export const WhitelistRequestModel = model('WhitelistRequest', whitelistRequestSchema)
