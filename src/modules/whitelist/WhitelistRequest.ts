import type { Edition } from '../../config/types.js'

export type RequestStatus = 'pending' | 'approved' | 'rejected'

/** A whitelist request, as stored in datas/whitelist-requests.json. Dates are ISO strings. */
export interface WhitelistRequest {
  /** Short ID used in the staff message buttons, eg. "whitelist:approve:3f2a1b9c0d4e". */
  requestId: string
  userId: string
  userTag: string
  edition: Edition
  username: string
  whitelistName: string
  status: RequestStatus
  staffMessageId: string | null
  reason: string | null
  decidedBy: string | null
  decidedAt: string | null
  /** Whether the player received the decision by DM. */
  notified: boolean | null
  createdAt: string
  updatedAt: string
}
