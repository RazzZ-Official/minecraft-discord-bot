const chalk = require('chalk')
const { whitelist } = require('../../config')
const { getDateNow, getError, consoleLogTranslation } = require('../index')
const { decisionLog, removalLog, editionName, entryEdition } = require('./embeds')

const text = consoleLogTranslation.whitelist

const fillFields = (string, request, staffTag) =>
  string
    .replace(/\{user\}/gi, chalk.cyan(request.userTag ?? ''))
    .replace(/\{username\}/gi, chalk.cyan(request.whitelistName))
    .replace(/\{edition\}/gi, editionName(request.edition))
    .replace(/\{staff\}/gi, chalk.cyan(staffTag))

const logConsole = (message) => console.log(`${getDateNow()} | ${chalk.magenta('WHITELIST')} | ${message}`)

const logRequest = (request) => logConsole(fillFields(text.requested, request))

const sendToLogChannel = async (client, message) => {
  if (!whitelist.logChannelId) return
  try {
    const channel = await client.channels.fetch(whitelist.logChannelId)
    await channel.send(message)
  } catch (error) {
    getError(error, 'whitelistLog')
  }
}

/** Logs a decision to the console and, if configured, to the log channel. */
const logDecision = async (client, request, staffTag) => {
  logConsole(fillFields(text[request.status], request, staffTag))
  await sendToLogChannel(client, decisionLog(request))
}

/** Logs a staff removal to the console and, if configured, to the log channel. */
const logRemoval = async (client, entry, staffUser) => {
  logConsole(fillFields(text.removed, { whitelistName: entry.name, edition: entryEdition(entry) }, staffUser.tag))
  await sendToLogChannel(client, removalLog(entry, staffUser.id))
}

module.exports = { logRequest, logDecision, logRemoval }
