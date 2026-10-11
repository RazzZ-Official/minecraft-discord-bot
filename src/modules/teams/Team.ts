import type { MinecraftColor } from './TeamNames.js'

export interface TeamBase {
  x: number
  y: number
  z: number
  note: string | null
  /** The pinned base message in the team chat. */
  messageId: string | null
}

/** A team, as stored in datas/teams.json. */
export interface Team {
  /** The in-game scoreboard team, eg. "team_rz". */
  teamId: string
  name: string
  /** 2-4 letters or digits, eg. "RZ". Shown as [RZ] in game and in nicknames. */
  tag: string
  color: MinecraftColor
  guildId: string
  leaderId: string
  /** Discord IDs of every member, the leader included. */
  memberIds: string[]
  roleId: string
  categoryId: string
  chatChannelId: string
  galleryChannelId: string
  voiceChannelId: string
  base: TeamBase | null
  createdBy: string
  createdAt: string
}

/** An invite sent by a team leader, as stored in datas/team-invites.json. */
export interface TeamInvite {
  inviteId: string
  teamId: string
  userId: string
  invitedBy: string
  createdAt: string
  expiresAt: string
}
