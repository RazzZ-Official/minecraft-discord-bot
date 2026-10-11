import { AttachmentBuilder } from 'discord.js'
import path from 'node:path'

export interface BannerImage {
  /** URL to put in an embed's image, or null when there is no banner. */
  imageUrl: string | null
  /** Files to attach to the message. */
  files: AttachmentBuilder[]
}

/**
 * Resolves a banner setting (an image URL or a local file path) to an embed image. Local files are attached to the
 * message so their link never expires.
 */
export class Banner {
  constructor(private readonly setting: string) {}

  /**
   * @param attachedFileNames Files already on the message being edited. The banner is only uploaded once; Discord
   *   keeps existing attachments on edits.
   */
  resolve(attachedFileNames: readonly string[] = []): BannerImage {
    if (!this.setting) return { imageUrl: null, files: [] }
    if (/^https?:\/\//i.test(this.setting)) return { imageUrl: this.setting, files: [] }

    const fileName = path.basename(this.setting)
    const files = attachedFileNames.includes(fileName)
      ? []
      : [new AttachmentBuilder(path.resolve(this.setting), { name: fileName })]
    return { imageUrl: `attachment://${fileName}`, files }
  }
}
