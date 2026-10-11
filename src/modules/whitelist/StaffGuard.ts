import type { Interaction } from 'discord.js'
import type { WhitelistConfig } from '../../config/types.js'
import { RoleGuard } from '../../shared/RoleGuard.js'

/** Decides who counts as whitelist staff. */
export class StaffGuard {
  private readonly staff: RoleGuard
  private readonly reviewers: RoleGuard

  constructor(config: WhitelistConfig) {
    this.staff = new RoleGuard(config.staffRoleIds)
    this.reviewers = new RoleGuard(config.staffRoleIds, config.staffChannelId)
  }

  /** Members with a staff role, or Administrators when no staff roles are set. */
  isStaff(interaction: Interaction): boolean {
    return this.staff.hasRole(interaction)
  }

  /** Reviewing requests and managing the whitelist is only allowed in the staff channel. */
  canReview(interaction: Interaction): boolean {
    return this.reviewers.allows(interaction)
  }
}
