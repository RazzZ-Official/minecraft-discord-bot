const { MessageFlags } = require('discord.js')
const { cmdSlashTranslation, getError } = require('../../index')
const { addToWhitelist } = require('../../whitelist/panel')
const { CUSTOM_ID, staffRequestMessage, rejectReasonModal, decisionDm, statusText } = require('../../whitelist/embeds')
const { logDecision } = require('../../whitelist/logger')
const { isStaff } = require('../../whitelist/staff')
const store = require('../../whitelist/store')

const text = cmdSlashTranslation.whitelist

// Requests currently being decided, so two staff members cannot act on the same request at once.
const inProgress = new Set()

const replyEphemeral = (interaction, content) => {
  const payload = { content, flags: MessageFlags.Ephemeral }
  return interaction.replied || interaction.deferred ? interaction.followUp(payload) : interaction.reply(payload)
}

const notifyPlayer = async (client, request) => {
  try {
    const user = await client.users.fetch(request.userId)
    await user.send(decisionDm(request))
    return true
  } catch {
    return false
  }
}

// Runs after a decision is saved: notifies the player and logs the result.
const completeDecision = async (interaction, request) => {
  const notified = await notifyPlayer(interaction.client, request)
  const saved = store.updateRequest(request.id, { notified })
  if (!notified) await replyEphemeral(interaction, text.replies.dmFailed.replace(/\{user\}/gi, `<@${request.userId}>`))
  await logDecision(interaction.client, saved, interaction.user.tag)
}

const approve = async (interaction, request) => {
  await interaction.update(staffRequestMessage(request, { processing: true }))

  let failure
  try {
    const confirmed = await addToWhitelist(request.edition, request.username)
    if (!confirmed) failure = text.replies.notVerified.replace(/\{username\}/gi, request.whitelistName)
  } catch (error) {
    failure = error.message
    getError(error, 'whitelistPanel')
  }
  if (failure) {
    // The request stays pending so staff can retry or reject it.
    await interaction.editReply(staffRequestMessage(request))
    await replyEphemeral(
      interaction,
      text.replies.approveFailed.replace(/\{username\}/gi, request.whitelistName).replace(/\{error\}/gi, failure)
    )
    return
  }

  const approved = store.updateRequest(request.id, {
    status: 'approved',
    decidedBy: interaction.user.id,
    decidedAt: new Date().toISOString(),
  })
  await interaction.editReply(staffRequestMessage(approved))
  await completeDecision(interaction, approved)
}

const reject = async (interaction, request) => {
  const reason = interaction.fields.getTextInputValue('reason').trim()
  const rejected = store.updateRequest(request.id, {
    status: 'rejected',
    reason: reason || null,
    decidedBy: interaction.user.id,
    decidedAt: new Date().toISOString(),
  })
  await interaction.update(staffRequestMessage(rejected))
  await completeDecision(interaction, rejected)
}

// Nothing is returned from this handler, because a truthy return value stops CommandKit's event loop.
module.exports = async (interaction) => {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return
  if (!interaction.customId.startsWith('whitelist:')) return

  const separatorIndex = interaction.customId.lastIndexOf(':')
  const action = interaction.customId.slice(0, separatorIndex)
  const requestId = interaction.customId.slice(separatorIndex + 1)

  try {
    if (!isStaff(interaction)) {
      await replyEphemeral(interaction, text.replies.notStaff)
      return
    }
    const request = store.getRequest(requestId)
    if (!request) {
      await replyEphemeral(interaction, text.replies.notFound)
      return
    }
    if (request.status !== 'pending') {
      await replyEphemeral(interaction, text.replies.alreadyHandled.replace(/\{status\}/gi, statusText(request)))
      return
    }
    if (inProgress.has(requestId)) {
      await replyEphemeral(interaction, text.replies.inProgress)
      return
    }
    if (action === CUSTOM_ID.reject) {
      await interaction.showModal(rejectReasonModal(request))
      return
    }

    inProgress.add(requestId)
    try {
      if (action === CUSTOM_ID.approve) await approve(interaction, request)
      else if (action === CUSTOM_ID.rejectReason) await reject(interaction, request)
    } finally {
      inProgress.delete(requestId)
    }
  } catch (error) {
    getError(error, 'whitelistDecision')
    await replyEphemeral(interaction, text.replies.error).catch(() => {})
  }
}
