import { Schema, model } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/** The voice channel whose name shows the player count, one per guild. */
const playerCountChannelSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
  },
  { timestamps: true }
)

export type PlayerCountChannel = InferSchemaType<typeof playerCountChannelSchema>

export const PlayerCountChannelModel = model('PlayerCountChannel', playerCountChannelSchema)
