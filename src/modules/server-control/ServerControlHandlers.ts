import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js'
import { SlashCommand } from '../../core/commands/SlashCommand.js'
import { ButtonHandler } from '../../core/components/ComponentHandler.js'
import type { AuditLog } from '../../services/AuditLog.js'
import type { PowerAction } from '../../services/PanelClient.js'
import { fill } from '../../shared/format.js'
import type { RoleGuard } from '../../shared/RoleGuard.js'
import { isPowerAction, PowerLabels, ServerControlIds, ServerControlText } from './messages.js'
import type { PowerResult, ServerControlService } from './ServerControlService.js'
import type { ServerControlView } from './ServerControlView.js'

export interface ServerControlDeps {
  service: ServerControlService
  view: ServerControlView
  guard: RoleGuard
  audit: AuditLog
}

const text = ServerControlText

// Replies and returns false when the member may not control the server here.
const checkAccess = async (
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  guard: RoleGuard
): Promise<boolean> => {
  if (guard.allows(interaction)) return true
  await interaction.reply({ content: text.noPermission, flags: MessageFlags.Ephemeral })
  return false
}

const resultText = (action: PowerAction, result: PowerResult): string => {
  const verb = PowerLabels[action].verb
  if (result.kind === 'sent') return fill(text.done, { action: verb })
  if (result.kind === 'busy') return text.busy
  return fill(text.failed, { action: verb.toLowerCase(), error: result.message })
}

/** /server panel | status | start | stop | restart */
export class ServerCommand extends SlashCommand {
  readonly data = new SlashCommandBuilder()
    .setName('server')
    .setDescription(text.commands.server)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) => sub.setName('panel').setDescription(text.commands.panel))
    .addSubcommand((sub) => sub.setName('status').setDescription(text.commands.status))
    .addSubcommand((sub) => sub.setName('start').setDescription(text.commands.start))
    .addSubcommand((sub) => sub.setName('restart').setDescription(text.commands.restart))
    .addSubcommand((sub) => sub.setName('stop').setDescription(text.commands.stop))

  constructor(private readonly deps: ServerControlDeps) {
    super()
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await checkAccess(interaction, this.deps.guard))) return
    const subcommand = interaction.options.getSubcommand()
    if (subcommand === 'panel') await this.postPanel(interaction)
    else if (subcommand === 'status') await showStatus(interaction, this.deps)
    else if (isPowerAction(subcommand)) {
      await interaction.reply({ ...this.deps.view.confirmPrompt(subcommand), flags: MessageFlags.Ephemeral })
    }
  }

  private async postPanel(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel?.isSendable()) return
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    await interaction.channel.send(this.deps.view.panelMessage())
    await interaction.editReply(fill(text.panelPosted, { channel: `<#${interaction.channelId}>` }))
    await this.deps.audit.record(interaction.client, {
      actor: interaction.user,
      action: '🖥️ Control panel posted',
      summary: `posted the server control panel in #${interaction.channelId}.`,
      fields: [{ name: 'Channel', value: `<#${interaction.channelId}>`, inline: true }],
    })
  }
}

const showStatus = async (
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  deps: ServerControlDeps
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  const { resources, status } = await deps.service.status()
  await interaction.editReply({ embeds: [deps.view.statusEmbed(resources, status)] })
}

/** Start / Restart / Stop on the panel: asks for confirmation first. */
export class PowerButton extends ButtonHandler {
  readonly customId = ServerControlIds.power

  constructor(private readonly deps: ServerControlDeps) {
    super()
  }

  async handle(interaction: ButtonInteraction, action: string | undefined): Promise<void> {
    if (!isPowerAction(action) || !(await checkAccess(interaction, this.deps.guard))) return
    await interaction.reply({ ...this.deps.view.confirmPrompt(action), flags: MessageFlags.Ephemeral })
  }
}

/** "Yes" on the confirmation: sends the power action. */
export class ConfirmPowerButton extends ButtonHandler {
  readonly customId = ServerControlIds.confirm

  constructor(private readonly deps: ServerControlDeps) {
    super()
  }

  async handle(interaction: ButtonInteraction, action: string | undefined): Promise<void> {
    if (!isPowerAction(action) || !(await checkAccess(interaction, this.deps.guard))) return
    await interaction.update({ content: fill(text.working, { action: PowerLabels[action].verb }), components: [] })
    const result = await this.deps.service.power(interaction.client, action, interaction.user)
    await interaction.editReply({ content: resultText(action, result), components: [] })
  }
}

export class CancelPowerButton extends ButtonHandler {
  readonly customId = ServerControlIds.cancel

  async handle(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({ content: text.cancelled, components: [] })
  }
}

export class StatusButton extends ButtonHandler {
  readonly customId = ServerControlIds.status

  constructor(private readonly deps: ServerControlDeps) {
    super()
  }

  async handle(interaction: ButtonInteraction): Promise<void> {
    if (!(await checkAccess(interaction, this.deps.guard))) return
    await showStatus(interaction, this.deps)
  }
}
