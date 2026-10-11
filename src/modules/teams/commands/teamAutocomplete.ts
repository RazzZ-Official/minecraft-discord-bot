import type { AutocompleteInteraction } from 'discord.js'
import type { TeamService } from '../TeamService.js'

const AUTOCOMPLETE_LIMIT = 25

/** Suggests teams by tag or name, eg. "[RZ] Razz Warriors". */
export const teamAutocomplete = async (interaction: AutocompleteInteraction, service: TeamService): Promise<void> => {
  const typed = interaction.options.getFocused().toLowerCase()
  const choices = service
    .all()
    .filter((team) => team.tag.toLowerCase().includes(typed) || team.name.toLowerCase().includes(typed))
    .slice(0, AUTOCOMPLETE_LIMIT)
    .map((team) => ({ name: `[${team.tag}] ${team.name}`, value: team.tag }))
  await interaction.respond(choices)
}
