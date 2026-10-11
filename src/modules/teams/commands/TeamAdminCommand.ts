import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js'
import { SlashCommand } from '../../../core/commands/SlashCommand.js'
import { fill } from '../../../shared/format.js'
import type { RoleGuard } from '../../../shared/RoleGuard.js'
import { TeamText } from '../messages.js'
import { problemText } from '../replies.js'
import type { Team } from '../Team.js'
import { COLOR_CHOICES, isMinecraftColor } from '../TeamNames.js'
import type { TeamResult, TeamService } from '../TeamService.js'
import { teamAutocomplete } from './teamAutocomplete.js'

const replies = TeamText.replies

const teamOption = (sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder =>
  sub.addStringOption((option) =>
    option.setName('team').setDescription('Team tag or name.').setRequired(true).setAutocomplete(true)
  )
const playerOption = (sub: SlashCommandSubcommandBuilder, description: string): SlashCommandSubcommandBuilder =>
  sub.addUserOption((option) => option.setName('player').setDescription(description).setRequired(true))

/** /teamadmin create | delete | rename | recolor | add | remove | setleader | lock | unlock | resync */
export class TeamAdminCommand extends SlashCommand {
  readonly data = new SlashCommandBuilder()
    .setName('teamadmin')
    .setDescription(TeamText.commands.admin)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Creates a team with its role and private channels.')
        .addStringOption((option) =>
          option.setName('name').setDescription('Team name, eg. Razz Warriors').setRequired(true).setMaxLength(24)
        )
        .addStringOption((option) =>
          option.setName('tag').setDescription('2-4 letters, eg. RZ').setRequired(true).setMinLength(2).setMaxLength(4)
        )
        .addStringOption((option) =>
          option
            .setName('color')
            .setDescription('Team colour, in game and in Discord.')
            .setRequired(true)
            .addChoices(...COLOR_CHOICES)
        )
        .addUserOption((option) => option.setName('leader').setDescription('The team leader.').setRequired(true))
    )
    .addSubcommand((sub) => teamOption(sub.setName('delete').setDescription('Deletes a team, its role and channels.')))
    .addSubcommand((sub) =>
      teamOption(sub.setName('rename').setDescription('Renames a team.')).addStringOption((option) =>
        option.setName('name').setDescription('The new name.').setRequired(true).setMaxLength(24)
      )
    )
    .addSubcommand((sub) =>
      teamOption(sub.setName('recolor').setDescription('Changes a team colour.')).addStringOption((option) =>
        option
          .setName('color')
          .setDescription('The new colour.')
          .setRequired(true)
          .addChoices(...COLOR_CHOICES)
      )
    )
    .addSubcommand((sub) =>
      playerOption(
        teamOption(sub.setName('add').setDescription('Adds a player to a team without an invite.')),
        'The player to add.'
      )
    )
    .addSubcommand((sub) =>
      playerOption(sub.setName('remove').setDescription('Removes a player from their team.'), 'The player to remove.')
    )
    .addSubcommand((sub) =>
      playerOption(
        teamOption(sub.setName('setleader').setDescription('Changes the leader of a team.')),
        'The new leader.'
      )
    )
    .addSubcommand((sub) => sub.setName('lock').setDescription('Freezes all team changes, eg. during events.'))
    .addSubcommand((sub) => sub.setName('unlock').setDescription('Allows team changes again.'))
    .addSubcommand((sub) => sub.setName('resync').setDescription('Makes the in-game teams match Discord now.'))

  constructor(
    private readonly service: TeamService,
    private readonly guard: RoleGuard
  ) {
    super()
  }

  override autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    return teamAutocomplete(interaction, this.service)
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return
    if (!this.guard.hasRole(interaction)) {
      await interaction.reply({ content: replies.notAdmin, flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const { guild, user, options, client } = interaction
    const subcommand = options.getSubcommand()

    if (subcommand === 'lock' || subcommand === 'unlock') {
      await this.service.setLocked(client, user, subcommand === 'lock')
      await interaction.editReply(subcommand === 'lock' ? replies.lockedNow : replies.unlockedNow)
      return
    }
    if (subcommand === 'resync') {
      await interaction.editReply(replies.syncing)
      try {
        const report = await this.service.resync()
        await interaction.editReply(
          fill(replies.synced, {
            teams: report.teams,
            joined: report.joined.length,
            left: report.left.length,
            removed: report.removedTeams.length,
          })
        )
      } catch (error) {
        await interaction.editReply(
          fill(replies.syncFailed, { error: error instanceof Error ? error.message : String(error) })
        )
      }
      return
    }
    if (subcommand === 'create') {
      const color = options.getString('color', true)
      if (!isMinecraftColor(color)) return
      const result = await this.service.create(guild, user, {
        name: options.getString('name', true),
        tag: options.getString('tag', true),
        color,
        leader: options.getUser('leader', true),
      })
      await interaction.editReply(
        result.ok
          ? fill(replies.created, {
              tag: result.value.tag,
              name: result.value.name,
              leader: `<@${result.value.leaderId}>`,
              channel: `<#${result.value.chatChannelId}>`,
            })
          : problemText(result.problem)
      )
      return
    }
    if (subcommand === 'remove') {
      const player = options.getUser('player', true)
      const result = await this.service.removeMember(guild, user, player)
      await interaction.editReply(this.outcome(result, replies.removed, { user: `<@${player.id}>` }))
      return
    }

    const query = options.getString('team', true)
    const team = this.service.find(query)
    if (!team) {
      await interaction.editReply(fill(replies.teamNotFound, { team: query }))
      return
    }
    const player = options.getUser('player')
    switch (subcommand) {
      case 'delete':
        await this.service.delete(guild, user, team)
        await interaction.editReply(fill(replies.deleted, { tag: team.tag, name: team.name }))
        return
      case 'rename':
        await interaction.editReply(
          this.outcome(await this.service.rename(guild, user, team, options.getString('name', true)), replies.renamed)
        )
        return
      case 'recolor': {
        const color = options.getString('color', true)
        if (!isMinecraftColor(color)) return
        const updated = await this.service.recolor(guild, user, team, color)
        await interaction.editReply(fill(replies.recolored, { tag: updated.tag, color }))
        return
      }
      case 'add':
        if (!player) return
        await interaction.editReply(
          this.outcome(await this.service.addMember(guild, user, team, player), replies.added, {
            user: `<@${player.id}>`,
          })
        )
        return
      case 'setleader':
        if (!player) return
        await interaction.editReply(
          this.outcome(await this.service.setLeader(guild, user, team, player), replies.transferred, {
            user: `<@${player.id}>`,
          })
        )
    }
  }

  private outcome(result: TeamResult<Team>, template: string, values: Record<string, string> = {}): string {
    if (!result.ok) return problemText(result.problem)
    return fill(template, { tag: result.value.tag, name: result.value.name, ...values })
  }
}
