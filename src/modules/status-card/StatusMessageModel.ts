import { Schema, model } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/** A live status message created with /setstatus, edited on every update. */
const statusMessageSchema = new Schema(
  {
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    ip: { type: String, required: true },
    port: { type: Number, required: true },
    edition: { type: String, enum: ['java', 'bedrock'], required: true },
    /** Mention saved when the message was created ("everyone", a role ID, or ""). Kept visible on every edit. */
    mention: { type: String, default: '' },
  },
  { timestamps: true }
)

export type StatusMessage = InferSchemaType<typeof statusMessageSchema>

export const StatusMessageModel = model('StatusMessage', statusMessageSchema)
