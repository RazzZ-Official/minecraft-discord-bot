import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js'
import { SlashCommand } from '../../../core/commands/SlashCommand.js'
import { editionName, fill, stripBackticks } from '../../../shared/format.js'
import { WhitelistText } from '../messages.js'
import { PlayerName } from '../PlayerName.js'
import type { WhitelistEntry } from '../PlayerName.js'
import type { StaffGuard } from '../StaffGuard.js'
import type { WhitelistService } from '../WhitelistService.js'
import type { WhitelistViews } from '../WhitelistViews.js'

const replies = WhitelistText.replies
// Autocomplete runs on every keystroke, so the whitelist is cached briefly instead of read from the panel each time.
const AUTOCOMPLETE_CACHE_MS = 30_000
const AUTOCOMPLETE_LIMIT = 25

/** /whitelist list and /whitelist remove, for staff in the staff channel. */
export class WhitelistCommand extends SlashCommand {
  readonly data = new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription(WhitelistText.commands.whitelist)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription(WhitelistText.commands.list))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('link')
        .setDescription(WhitelistText.commands.link)
        .addUserOption((option) =>
          option.setName('player').setDescription(WhitelistText.commands.linkPlayer).setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('username')
            .setDescription(WhitelistText.commands.linkUsername)
            .setRequired(true)
            .setMaxLength(32)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription(WhitelistText.commands.remove)
        .addStringOption((option) =>
          option
            .setName('username')
            .setDescription(WhitelistText.commands.removeUsername)
            .setRequired(true)
            .setMaxLength(32)
            .setAutocomplete(true)
        )
    )

  private autocompleteCache: { entries: WhitelistEntry[]; fetchedAt: number } = { entries: [], fetchedAt: 0 }

  constructor(
    private readonly service: WhitelistService,
    private readonly views: WhitelistViews,
    private readonly guard: StaffGuard
  ) {
    super()
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.guard.canReview(interaction)) {
      await interaction.reply({ content: replies.notStaff, flags: MessageFlags.Ephemeral })
      return
    }
    const subcommand = interaction.options.getSubcommand()
    if (subcommand === 'list') await this.list(interaction)
    else if (subcommand === 'link') await this.link(interaction)
    else await this.remove(interaction)
  }

  override async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    // Whitelisted names are only suggested to staff.
    if (!this.guard.canReview(interaction)) {
      await interaction.respond([])
      return
    }
    if (Date.now() - this.autocompleteCache.fetchedAt > AUTOCOMPLETE_CACHE_MS) {
      this.autocompleteCache = { entries: await this.service.listEntries(), fetchedAt: Date.now() }
    }
    const typed = interaction.options.getFocused().toLowerCase()
    const choices = this.autocompleteCache.entries
      .filter((entry) => entry.name.toLowerCase().includes(typed))
      .slice(0, AUTOCOMPLETE_LIMIT)
      .map((entry) => ({ name: entry.name, value: entry.name }))
    await interaction.respond(choices)
  }

  // Links a member who was whitelisted before the bot handled requests, and sets their nickname.
  private async link(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const member = interaction.options.getUser('player', true)
    const input = interaction.options.getString('username', true)
    const entry = await this.service
      .linkExisting(interaction.client, interaction.guild, interaction.user, member, input)
      .catch(() => undefined)
    if (entry === undefined) await interaction.editReply(replies.panelError)
    else if (!entry) await interaction.editReply(fill(replies.removeNotFound, { username: stripBackticks(input) }))
    else await interaction.editReply(fill(replies.linked, { user: `<@${member.id}>`, username: entry.name }))
  }

  private async list(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const entries = await this.service.listEntries().catch(() => null)
    if (!entries) await interaction.editReply(replies.panelError)
    else if (!entries.length) await interaction.editReply(replies.listEmpty)
    else await interaction.editReply(this.views.listMessage(entries))
  }

  // The reply is public, so other staff in the channel can see who removed whom.
  private async remove(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply()
    const input = interaction.options.getString('username', true)
    const result = await this.service.remove(interaction.client, input, interaction.user).catch(() => null)
    if (!result) {
      await interaction.editReply(replies.panelError)
      return
    }
    switch (result.kind) {
      case 'not-found':
        await interaction.editReply(fill(replies.removeNotFound, { username: stripBackticks(input) }))
        return
      case 'ambiguous':
        await interaction.editReply(fill(replies.removeAmbiguous, { username: result.entry.name }))
        return
      case 'failed': {
        const error =
          result.reason === 'not-verified'
            ? fill(replies.removeNotVerified, { username: result.entry.name })
            : (result.message ?? replies.panelError)
        await interaction.editReply(fill(replies.removeFailed, { username: result.entry.name, error }))
        return
      }
      case 'removed':
        this.autocompleteCache.fetchedAt = 0
        await interaction.editReply(
          fill(replies.removed, {
            username: result.entry.name,
            edition: editionName(PlayerName.entryEdition(result.entry)),
            staff: `<@${interaction.user.id}>`,
          })
        )
    }
  }
}
