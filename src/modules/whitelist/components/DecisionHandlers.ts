import { MessageFlags } from 'discord.js'
import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js'
import { ButtonHandler, ModalHandler } from '../../../core/components/ComponentHandler.js'
import { fill } from '../../../shared/format.js'
import { WhitelistIds, WhitelistText } from '../messages.js'
import type { StaffGuard } from '../StaffGuard.js'
import type { WhitelistRequest } from '../WhitelistRequest.js'
import type { DecisionResult, ReviewStart, WhitelistService } from '../WhitelistService.js'
import type { WhitelistViews } from '../WhitelistViews.js'

const replies = WhitelistText.replies

export interface DecisionDeps {
  service: WhitelistService
  views: WhitelistViews
  guard: StaffGuard
}

type ReviewInteraction = ButtonInteraction | ModalSubmitInteraction

/** Shared steps of the staff decision handlers. */
class DecisionFlow {
  constructor(private readonly deps: DecisionDeps) {}

  /** Replies and returns null when the member cannot review, or the request cannot be decided. */
  async start(
    interaction: ReviewInteraction,
    requestId: string | undefined,
    reserve: boolean
  ): Promise<WhitelistRequest | null> {
    if (!requestId) return null
    if (!this.deps.guard.canReview(interaction)) {
      await this.reply(interaction, replies.notStaff)
      return null
    }
    const start = reserve ? this.deps.service.beginReview(requestId) : this.deps.service.inspect(requestId)
    if (start.kind === 'ok') return start.request
    await this.reply(interaction, this.startProblem(start))
    return null
  }

  /** Updates the staff message to the result, and tells the staff member about anything that went wrong. */
  async showResult(interaction: ReviewInteraction, original: WhitelistRequest, result: DecisionResult): Promise<void> {
    if (result.kind === 'decided') {
      await interaction.editReply(this.deps.views.staffRequestMessage(result.request))
      if (!result.notified)
        await this.reply(interaction, fill(replies.dmFailed, { user: `<@${result.request.userId}>` }))
      return
    }
    if (result.kind === 'already-handled') {
      const current = result.request ?? original
      await interaction.editReply(this.deps.views.staffRequestMessage(current))
      await this.reply(interaction, fill(replies.alreadyHandled, { status: this.deps.views.statusText(current) }))
      return
    }
    // Approving failed: restore the buttons so staff can retry or reject.
    await interaction.editReply(this.deps.views.staffRequestMessage(original))
    const error =
      result.reason === 'not-verified'
        ? fill(replies.notVerified, { username: original.whitelistName })
        : (result.message ?? replies.panelError)
    await this.reply(interaction, fill(replies.approveFailed, { username: original.whitelistName, error }))
  }

  private startProblem(start: Exclude<ReviewStart, { kind: 'ok' }>): string {
    if (start.kind === 'not-found') return replies.notFound
    if (start.kind === 'in-progress') return replies.inProgress
    return fill(replies.alreadyHandled, { status: this.deps.views.statusText(start.request) })
  }

  private async reply(interaction: ReviewInteraction, content: string): Promise<void> {
    const payload = { content, flags: MessageFlags.Ephemeral } as const
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload)
    else await interaction.reply(payload)
  }
}

/** Approve: adds the player to the whitelist, then records and announces the decision. */
export class ApproveButton extends ButtonHandler {
  readonly customId = WhitelistIds.approve
  private readonly flow: DecisionFlow

  constructor(private readonly deps: DecisionDeps) {
    super()
    this.flow = new DecisionFlow(deps)
  }

  async handle(interaction: ButtonInteraction, requestId: string | undefined): Promise<void> {
    const request = await this.flow.start(interaction, requestId, true)
    if (!request) return
    try {
      await interaction.update(this.deps.views.staffRequestMessage(request, true))
      const result = await this.deps.service.approve(interaction.client, interaction.guild, request, interaction.user)
      await this.flow.showResult(interaction, request, result)
    } finally {
      this.deps.service.endReview(request.requestId)
    }
  }
}

/** Reject: opens a form for an optional reason. */
export class RejectButton extends ButtonHandler {
  readonly customId = WhitelistIds.reject
  private readonly flow: DecisionFlow

  constructor(private readonly deps: DecisionDeps) {
    super()
    this.flow = new DecisionFlow(deps)
  }

  async handle(interaction: ButtonInteraction, requestId: string | undefined): Promise<void> {
    const request = await this.flow.start(interaction, requestId, false)
    if (request) await interaction.showModal(this.deps.views.rejectReasonModal(request.requestId))
  }
}

/** The submitted reject form: records the rejection and tells the player. */
export class RejectReasonModal extends ModalHandler {
  readonly customId = WhitelistIds.rejectReason
  private readonly flow: DecisionFlow

  constructor(private readonly deps: DecisionDeps) {
    super()
    this.flow = new DecisionFlow(deps)
  }

  async handle(interaction: ModalSubmitInteraction, requestId: string | undefined): Promise<void> {
    if (!interaction.isFromMessage()) return
    const request = await this.flow.start(interaction, requestId, true)
    if (!request) return
    try {
      await interaction.deferUpdate()
      const reason = interaction.fields.getTextInputValue('reason').trim() || null
      const result = await this.deps.service.reject(interaction.client, request, interaction.user, reason)
      await this.flow.showResult(interaction, request, result)
    } finally {
      this.deps.service.endReview(request.requestId)
    }
  }
}
