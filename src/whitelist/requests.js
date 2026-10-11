const { whitelist } = require('../../config')
const { cmdSlashTranslation, getError } = require('../index')
const { parsePlayer } = require('./username')
const { isWhitelisted } = require('./panel')
const { staffRequestMessage, editionName } = require('./embeds')
const { logRequest } = require('./logger')
const store = require('./store')

const text = cmdSlashTranslation.whitelist

const fillFields = (string, fields) =>
  string
    .replace(/\{username\}/gi, fields.username)
    .replace(/\{edition\}/gi, fields.edition ? editionName(fields.edition) : '')

/**
 * Validates a whitelist request, posts it in the staff channel and returns the reply for the player.
 * Errors are logged and turned into a generic reply.
 */
const submitRequest = async (client, user, edition, rawName) => {
  try {
    const player = parsePlayer(edition, rawName)
    if (!player) {
      const invalidReply = edition === 'bedrock' ? text.replies.invalidBedrock : text.replies.invalidJava
      return fillFields(invalidReply, { username: rawName.replace(/`/g, '') })
    }

    // A panel outage should not block requests, so this check is skipped if the whitelist cannot be read.
    try {
      if (await isWhitelisted(player.whitelistName)) {
        return fillFields(text.replies.alreadyWhitelisted, { username: player.whitelistName })
      }
    } catch (error) {
      getError(error, 'whitelistPanel')
    }

    // Duplicate checks run right before the request is created, with no await in between.
    const ownPending = store.findPendingByUser(user.id)
    if (ownPending) return fillFields(text.replies.alreadyPending, { username: ownPending.whitelistName })
    if (store.findPendingByName(player.whitelistName)) {
      return fillFields(text.replies.namePending, { username: player.whitelistName })
    }

    const request = store.createRequest({ userId: user.id, userTag: user.tag, ...player })
    try {
      const staffChannel = await client.channels.fetch(whitelist.staffChannelId)
      const message = await staffChannel.send(staffRequestMessage(request))
      store.updateRequest(request.id, { staffMessageId: message.id })
    } catch (error) {
      store.deleteRequest(request.id)
      throw error
    }

    logRequest(request)
    return fillFields(text.replies.submitted, { username: player.whitelistName, edition: player.edition })
  } catch (error) {
    getError(error, 'whitelistRequest')
    return text.replies.error
  }
}

module.exports = { submitRequest }
