import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js'
import { SlashCommand } from '../../../core/commands/SlashCommand.js'
import { fill } from '../../../shared/format.js'
import { TeamText } from '../messages.js'
import { problemText } from '../replies.js'
import type { Team } from '../Team.js'
import type { TeamResult, TeamService } from '../TeamService.js'
import type { TeamViews } from '../TeamViews.js'
import { teamAutocomplete } from './teamAutocomplete.js'

const replies = TeamText.replies
const COORDINATE_LIMIT = 30_000_000

/** /team info | list | leave | kick | transfer | base set | base show | announce */
export class TeamCommand extends SlashCommand {
  readonly data = new SlashCommandBuilder()
    .setName('team')
    .setDescription(TeamText.commands.team)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Shows a team. Your own team by default.')
        .addStringOption((option) => option.setName('team').setDescription('Team tag or name.').setAutocomplete(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Lists every team.'))
    .addSubcommand((sub) => sub.setName('leave').setDescription('Leaves your team.'))
    .addSubcommand((sub) =>
      sub
        .setName('kick')
        .setDescription('Removes a member from your team. Leaders only.')
        .addUserOption((option) => option.setName('player').setDescription('The member to remove.').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('transfer')
        .setDescription('Makes another member the leader. Leaders only.')
        .addUserOption((option) => option.setName('player').setDescription('The new leader.').setRequired(true))
    )
    .addSubcommandGroup((group) =>
      group
        .setName('base')
        .setDescription('Your team base.')
        .addSubcommand((sub) =>
          sub
            .setName('set')
            .setDescription('Saves and pins the base coordinates. Leaders only.')
            .addIntegerOption((option) =>
              option
                .setName('x')
                .setDescription('X')
                .setRequired(true)
                .setMinValue(-COORDINATE_LIMIT)
                .setMaxValue(COORDINATE_LIMIT)
            )
            .addIntegerOption((option) =>
              option.setName('y').setDescription('Y').setRequired(true).setMinValue(-64).setMaxValue(320)
            )
            .addIntegerOption((option) =>
              option
                .setName('z')
                .setDescription('Z')
                .setRequired(true)
                .setMinValue(-COORDINATE_LIMIT)
                .setMaxValue(COORDINATE_LIMIT)
            )
            .addStringOption((option) =>
              option.setName('note').setDescription('eg. "Main base, nether portal inside"').setMaxLength(200)
            )
        )
        .addSubcommand((sub) => sub.setName('show').setDescription('Shows your team base.'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('announce')
        .setDescription('Posts an announcement in your team chat. Leaders only.')
        .addStringOption((option) =>
          option.setName('message').setDescription('The announcement.').setRequired(true).setMaxLength(1000)
        )
    )

  constructor(
    private readonly service: TeamService,
    private readonly views: TeamViews
  ) {
    super()
  }

  override autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    return teamAutocomplete(interaction, this.service)
  }

  // Actions that change the team: leaving, and the leader-only ones.
  private runAction(interaction: ChatInputCommandInteraction<'cached'>, action: string): Promise<TeamResult<Team>> {
    const { guild, user, options } = interaction
    switch (action) {
      case 'set':
        return this.service.setBase(guild, user, {
          x: options.getInteger('x', true),
          y: options.getInteger('y', true),
          z: options.getInteger('z', true),
          note: options.getString('note'),
        })
      case 'leave':
        return this.service.leave(guild, user)
      case 'kick':
        return this.service.kick(guild, user, options.getUser('player', true))
      case 'transfer':
        return this.service.transfer(guild, user, options.getUser('player', true))
      default:
        return this.service.announce(guild, user, options.getString('message', true))
    }
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const { user, options } = interaction
    const group = options.getSubcommandGroup(false)
    const subcommand = options.getSubcommand()

    if (subcommand === 'list') {
      const teams = this.service.all()
      await interaction.editReply(teams.length ? { embeds: [this.views.list(teams)] } : replies.noTeams)
      return
    }
    if (subcommand === 'info') {
      const query = options.getString('team')
      const team = query ? this.service.find(query) : this.service.teamOf(user.id)
      if (!team) await interaction.editReply(query ? fill(replies.teamNotFound, { team: query }) : replies.notInTeam)
      else await interaction.editReply({ embeds: [this.views.info(team)] })
      return
    }
    if (group === 'base' && subcommand === 'show') {
      const team = this.service.teamOf(user.id)
      if (!team) await interaction.editReply(replies.notInTeam)
      else await interaction.editReply(team.base ? this.views.base(team) : replies.noBase)
      return
    }

    const result = await this.runAction(interaction, group === 'base' ? 'set' : subcommand)
    if (!result.ok) {
      await interaction.editReply(problemText(result.problem))
      return
    }

    const team = result.value
    const target = options.getUser('player')
    const done: Record<string, string> = {
      leave: fill(replies.left, { tag: team.tag, name: team.name }),
      kick: fill(replies.kicked, { user: `<@${target?.id}>` }),
      transfer: fill(replies.transferred, { user: `<@${target?.id}>`, tag: team.tag, name: team.name }),
      set: fill(replies.baseSet, { channel: `<#${team.chatChannelId}>` }),
      announce: fill(replies.announced, { channel: `<#${team.chatChannelId}>` }),
    }
    await interaction.editReply(done[subcommand] ?? '✅')
  }
}
