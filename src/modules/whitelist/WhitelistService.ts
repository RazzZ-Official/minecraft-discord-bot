import type { Client, User } from 'discord.js'
import type { Edition } from '../../config/types.js'
import type { Logger } from '../../core/Logger.js'
import { PlayerName } from './PlayerName.js'
import type { WhitelistEntry } from './PlayerName.js'
import type { WhitelistGateway } from './WhitelistGateway.js'
import type { WhitelistNotifier } from './WhitelistNotifier.js'
import type { WhitelistRequest } from './WhitelistRequest.js'
import { DuplicatePendingRequestError } from './WhitelistRequestRepository.js'
import type { WhitelistRequestRepository } from './WhitelistRequestRepository.js'

export type SubmitResult =
  | { kind: 'invalid' }
  | { kind: 'already-whitelisted'; whitelistName: string }
  | { kind: 'already-pending'; whitelistName: string }
  | { kind: 'name-pending'; whitelistName: string }
  | { kind: 'submitted'; request: WhitelistRequest }

export type ReviewStart =
  | { kind: 'ok'; request: WhitelistRequest }
  | { kind: 'not-found' }
  | { kind: 'already-handled'; request: WhitelistRequest }
  | { kind: 'in-progress' }

export type DecisionResult =
  | { kind: 'decided'; request: WhitelistRequest; notified: boolean }
  | { kind: 'already-handled'; request: WhitelistRequest | null }
  | { kind: 'failed'; reason: 'not-verified' | 'error'; message?: string }

export type RemoveResult =
  | { kind: 'not-found' }
  | { kind: 'ambiguous'; entry: WhitelistEntry }
  | { kind: 'removed'; entry: WhitelistEntry }
  | { kind: 'failed'; entry: WhitelistEntry; reason: 'not-verified' | 'error'; message?: string }

/** Whitelist rules: submitting requests, staff decisions and removals. Discord replies are left to the handlers. */
export class WhitelistService {
  // Requests a staff member is deciding right now, so two staff members cannot act on the same request.
  private readonly reviewing = new Set<string>()

  constructor(
    private readonly requests: WhitelistRequestRepository,
    private readonly gateway: WhitelistGateway,
    private readonly notifier: WhitelistNotifier,
    private readonly logger: Logger
  ) {}

  async submit(client: Client, user: User, edition: Edition, rawName: string): Promise<SubmitResult> {
    const player = PlayerName.parse(edition, rawName)
    if (!player) return { kind: 'invalid' }

    // A panel outage should not block requests, so this check is skipped if the whitelist cannot be read.
    const alreadyWhitelisted = await this.gateway.isWhitelisted(player.whitelistName).catch((error: unknown) => {
      this.logger.error('Could not read the whitelist from the panel.', error)
      return false
    })
    if (alreadyWhitelisted) return { kind: 'already-whitelisted', whitelistName: player.whitelistName }

    const ownPending = this.requests.findPendingByUser(user.id)
    if (ownPending) return { kind: 'already-pending', whitelistName: ownPending.whitelistName }
    if (this.requests.findPendingByName(player.whitelistName)) {
      return { kind: 'name-pending', whitelistName: player.whitelistName }
    }

    let request: WhitelistRequest
    try {
      request = await this.requests.create({ ...player, userId: user.id, userTag: user.tag })
    } catch (error) {
      // Another request was created between the checks above and now.
      if (error instanceof DuplicatePendingRequestError)
        return { kind: 'name-pending', whitelistName: player.whitelistName }
      throw error
    }

    try {
      await this.requests.setStaffMessage(request.requestId, await this.notifier.postToStaff(client, request, user))
    } catch (error) {
      await this.requests.delete(request.requestId)
      throw error
    }
    return { kind: 'submitted', request }
  }

  /** Checks whether a request can be decided right now. */
  inspect(requestId: string): ReviewStart {
    const request = this.requests.findById(requestId)
    if (!request) return { kind: 'not-found' }
    if (request.status !== 'pending') return { kind: 'already-handled', request }
    if (this.reviewing.has(requestId)) return { kind: 'in-progress' }
    return { kind: 'ok', request }
  }

  /** Like inspect, and also reserves the request. Call endReview afterwards, also when the review fails. */
  beginReview(requestId: string): ReviewStart {
    const start = this.inspect(requestId)
    if (start.kind === 'ok') this.reviewing.add(requestId)
    return start
  }

  endReview(requestId: string): void {
    this.reviewing.delete(requestId)
  }

  /** Adds the player to the server whitelist, then records the decision, DMs the player and logs it. */
  async approve(client: Client, request: WhitelistRequest, staff: User): Promise<DecisionResult> {
    try {
      if (!(await this.gateway.add(request))) return { kind: 'failed', reason: 'not-verified' }
    } catch (error) {
      this.logger.error(`Could not whitelist ${request.whitelistName}.`, error)
      return { kind: 'failed', reason: 'error', message: error instanceof Error ? error.message : String(error) }
    }
    return this.decide(client, request.requestId, staff, { status: 'approved' })
  }

  reject(client: Client, request: WhitelistRequest, staff: User, reason: string | null): Promise<DecisionResult> {
    return this.decide(client, request.requestId, staff, { status: 'rejected', reason })
  }

  listEntries(): Promise<WhitelistEntry[]> {
    return this.gateway.list()
  }

  /** Entries matching staff input, case-insensitively. An exact match comes first. */
  async findEntries(input: string): Promise<WhitelistEntry[]> {
    const candidates = PlayerName.candidates(input)
    const lowered = candidates.map((candidate) => candidate.toLowerCase())
    const isExact = (entry: WhitelistEntry): boolean => candidates.includes(entry.name)
    return (await this.gateway.list())
      .filter((entry) => lowered.includes(entry.name.toLowerCase()))
      .sort((a, b) => Number(isExact(b)) - Number(isExact(a)))
  }

  async remove(client: Client, input: string, staff: User): Promise<RemoveResult> {
    const matches = await this.findEntries(input)
    const [entry] = matches
    if (!entry) return { kind: 'not-found' }
    // Java entries are removed by name, which the server resolves case-insensitively, so names that differ only in
    // capitalisation (eg. "boxick" and "Boxick") could remove the wrong player.
    const javaMatches = matches.filter((match) => PlayerName.entryEdition(match) === 'java')
    if (PlayerName.entryEdition(entry) === 'java' && javaMatches.length > 1) return { kind: 'ambiguous', entry }

    try {
      if (!(await this.gateway.remove(entry))) return { kind: 'failed', entry, reason: 'not-verified' }
    } catch (error) {
      this.logger.error(`Could not remove ${entry.name}.`, error)
      return { kind: 'failed', entry, reason: 'error', message: error instanceof Error ? error.message : String(error) }
    }
    await this.notifier.logRemoval(client, entry, staff)
    return { kind: 'removed', entry }
  }

  private async decide(
    client: Client,
    requestId: string,
    staff: User,
    decision: { status: 'approved' | 'rejected'; reason?: string | null }
  ): Promise<DecisionResult> {
    const decided = await this.requests.decide(requestId, { ...decision, decidedBy: staff.id })
    if (!decided) return { kind: 'already-handled', request: this.requests.findById(requestId) }

    const notified = await this.notifier.notifyPlayer(client, decided)
    await this.requests.setNotified(requestId, notified)
    const request = { ...decided, notified }
    await this.notifier.logDecision(client, request, staff)
    return { kind: 'decided', request, notified }
  }
}
