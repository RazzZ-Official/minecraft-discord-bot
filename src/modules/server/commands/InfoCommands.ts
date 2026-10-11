import { SlashCommandBuilder } from 'discord.js'
import type { BaseMessageOptions } from 'discord.js'
import type { ReplyContext } from '../../../core/commands/ReplyCommand.js'
import { Mention } from '../../../shared/Mention.js'
import { ServerText } from '../messages.js'
import { ServerCommand } from './ServerCommand.js'

// Commands that only show configured values.

export class IpCommand extends ServerCommand {
  protected readonly key = 'ip'
  readonly data = new SlashCommandBuilder().setName('ip').setDescription(ServerText.descriptions.ip)

  buildReply(): Promise<BaseMessageOptions> {
    return Promise.resolve({ embeds: [this.deps.views.ipEmbed()] })
  }
}

export class SiteCommand extends ServerCommand {
  protected readonly key = 'site'
  readonly data = new SlashCommandBuilder().setName('site').setDescription(ServerText.descriptions.site)

  override get enabled(): boolean {
    return super.enabled && Boolean(this.deps.config.server.site)
  }

  buildReply(): Promise<BaseMessageOptions> {
    return Promise.resolve({ embeds: [this.deps.views.siteEmbed()] })
  }
}

export class VersionCommand extends ServerCommand {
  protected readonly key = 'version'
  readonly data = new SlashCommandBuilder().setName('version').setDescription(ServerText.descriptions.version)

  buildReply(): Promise<BaseMessageOptions> {
    return Promise.resolve({ embeds: [this.deps.views.versionEmbed()] })
  }
}

// Commands that show the live server status.

export class MotdCommand extends ServerCommand {
  protected readonly key = 'motd'
  readonly data = new SlashCommandBuilder().setName('motd').setDescription(ServerText.descriptions.motd)

  async buildReply(): Promise<BaseMessageOptions> {
    return { embeds: [this.deps.views.motdEmbed(await this.deps.minecraft.getStatus())] }
  }
}

export class PlayersCommand extends ServerCommand {
  protected readonly key = 'players'
  readonly data = new SlashCommandBuilder().setName('players').setDescription(ServerText.descriptions.players)

  async buildReply(): Promise<BaseMessageOptions> {
    return { embeds: [this.deps.views.playersEmbed(await this.deps.minecraft.getStatus())] }
  }
}

export class StatusCommand extends ServerCommand {
  protected readonly key = 'status'
  readonly data = new SlashCommandBuilder().setName('status').setDescription(ServerText.descriptions.status)

  async buildReply(): Promise<BaseMessageOptions> {
    return { embeds: [this.deps.views.statusEmbed(await this.deps.minecraft.getStatus())] }
  }
}

export class ServerInfoCommand extends ServerCommand {
  protected readonly key = 'serverinfo'
  readonly data = new SlashCommandBuilder().setName('serverinfo').setDescription(ServerText.descriptions.serverinfo)

  async buildReply({ canMentionEveryone }: ReplyContext): Promise<BaseMessageOptions> {
    // The card still works without the live MOTD if the status API is unavailable.
    const status = await this.deps.minecraft.getStatus().catch(() => null)
    const mention = Mention.forMember(this.deps.config.serverInfo.mention, canMentionEveryone)
    return this.deps.views.serverInfoMessage(status, mention)
  }
}
