import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js'
import { SlashCommand } from '../../core/commands/SlashCommand.js'
import type { AuditLog } from '../../services/AuditLog.js'
import { fill, stripBackticks } from '../../shared/format.js'
import type { RoleGuard } from '../../shared/RoleGuard.js'
import { OperatorGateway } from './OperatorGateway.js'
import type { OperatorAction, OperatorResult } from './OperatorGateway.js'

const Text = {
  description: 'In-game operator commands. Top role only.',
  player: 'Player name. Bedrock players start with a dot, eg. .Connor_Leo2299',
  reason: 'Reason shown to the player.',
  message: 'Message to show in the game chat.',
  noPermission: ':no_entry: Operator commands are only for the top role, in the MC commands channel.',
  invalidPlayer: ':warning: **`{player}` is not a valid player name.**',
  failed: ':warning: **The command failed:** {error}',
  notConfirmed: ':warning: The command was sent, but the server files do not show the change yet. Check the console.',
} as const

const DONE: Record<OperatorAction, { emoji: string; title: string; reply: string }> = {
  op: { emoji: '👑', title: 'Operator added', reply: '✅ **{player}** is now an operator.' },
  deop: { emoji: '🔻', title: 'Operator removed', reply: '✅ **{player}** is no longer an operator.' },
  kick: { emoji: '👢', title: 'Player kicked', reply: '✅ Kicked **{player}**.' },
  ban: { emoji: '🔨', title: 'Player banned', reply: '✅ Banned **{player}**.' },
  unban: { emoji: '🕊️', title: 'Player unbanned', reply: '✅ Unbanned **{player}**.' },
  broadcast: { emoji: '📢', title: 'Broadcast sent', reply: '✅ Broadcast sent in the game chat.' },
}

const playerOption = (sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder =>
  sub.addStringOption((option) =>
    option.setName('player').setDescription(Text.player).setRequired(true).setMaxLength(17)
  )
const reasonOption = (sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder =>
  sub.addStringOption((option) => option.setName('reason').setDescription(Text.reason).setMaxLength(200))

/** /mc op | deop | kick | ban | unban | broadcast */
export class OperatorCommand extends SlashCommand {
  readonly data = new SlashCommandBuilder()
    .setName('mc')
    .setDescription(Text.description)
    .setContexts(InteractionContextType.Guild)
    // Hidden from everyone but Administrators. Other roles can be allowed in Server Settings > Integrations.
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => playerOption(sub.setName('op').setDescription('Makes a player an operator.')))
    .addSubcommand((sub) => playerOption(sub.setName('deop').setDescription('Removes operator from a player.')))
    .addSubcommand((sub) => reasonOption(playerOption(sub.setName('kick').setDescription('Kicks a player.'))))
    .addSubcommand((sub) => reasonOption(playerOption(sub.setName('ban').setDescription('Bans a player.'))))
    .addSubcommand((sub) => playerOption(sub.setName('unban').setDescription('Unbans a player.')))
    .addSubcommand((sub) =>
      sub
        .setName('broadcast')
        .setDescription('Shows a message in the game chat.')
        .addStringOption((option) =>
          option.setName('message').setDescription(Text.message).setRequired(true).setMaxLength(200)
        )
    )

  constructor(
    private readonly gateway: OperatorGateway,
    private readonly guard: RoleGuard,
    private readonly audit: AuditLog
  ) {
    super()
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.guard.allows(interaction)) {
      await interaction.reply({ content: Text.noPermission, flags: MessageFlags.Ephemeral })
      return
    }
    const action = interaction.options.getSubcommand() as OperatorAction
    const player = interaction.options.getString('player')?.trim() ?? ''
    if (action !== 'broadcast' && !OperatorGateway.isValidPlayer(player)) {
      await interaction.reply({
        content: fill(Text.invalidPlayer, { player: stripBackticks(player) }),
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    // Public, so other admins in the channel see what was done.
    await interaction.deferReply()
    const reason = interaction.options.getString('reason') ?? ''
    const message = interaction.options.getString('message') ?? ''
    let result: OperatorResult
    try {
      result = await this.run(action, player, reason, message)
    } catch (error) {
      await interaction.editReply(fill(Text.failed, { error: error instanceof Error ? error.message : String(error) }))
      return
    }

    const done = DONE[action]
    await interaction.editReply(result === 'not-confirmed' ? Text.notConfirmed : fill(done.reply, { player }))
    await this.audit.record(interaction.client, {
      actor: interaction.user,
      action: `${done.emoji} ${done.title}`,
      summary: action === 'broadcast' ? `broadcast "${message}" in game.` : `ran /mc ${action} on ${player}.`,
      fields: [
        ...(action === 'broadcast' ? [] : [{ name: 'Player', value: `\`${player}\``, inline: true }]),
        ...(reason ? [{ name: 'Reason', value: OperatorGateway.cleanText(reason) }] : []),
        ...(message ? [{ name: 'Message', value: OperatorGateway.cleanText(message) }] : []),
        ...(result === 'not-confirmed' ? [{ name: 'Note', value: 'Not confirmed by the server files.' }] : []),
      ],
      color: action === 'ban' || action === 'kick' ? 'Red' : 'Gold',
    })
  }

  private run(action: OperatorAction, player: string, reason: string, message: string): Promise<OperatorResult> {
    switch (action) {
      case 'op':
        return this.gateway.op(player)
      case 'deop':
        return this.gateway.deop(player)
      case 'kick':
        return this.gateway.kick(player, reason)
      case 'ban':
        return this.gateway.ban(player, reason)
      case 'unban':
        return this.gateway.unban(player)
      case 'broadcast':
        return this.gateway.broadcast(message)
    }
  }
}
