// Client for the hosting panel's client API (Reviactyl, a Pterodactyl fork). Feature modules build on this, such as
// src/whitelist/panel.js, which is the only place console commands are sent from.
const { panel } = require('../config')

const REQUEST_TIMEOUT_MS = 10_000

class PanelError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'PanelError'
    this.status = status
  }
}

const isPanelConfigured = () => Boolean(panel.url && panel.serverId && panel.apiKey)

const request = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(
    `${panel.url.replace(/\/+$/, '')}/api/client/servers/${encodeURIComponent(panel.serverId)}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${panel.apiKey.trim()}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  )
  if (!response.ok) {
    const detail = await response
      .json()
      .then((json) => json.errors?.[0]?.detail)
      .catch(() => undefined)
    throw new PanelError(detail || `Panel responded with HTTP ${response.status}`, response.status)
  }
  return response
}

/** @returns {Promise<number | null>} The server's uptime in milliseconds, or null if it is not running. */
const getServerUptime = async () => {
  const { attributes } = await (await request('/resources')).json()
  return attributes.current_state === 'running' ? attributes.resources.uptime : null
}

module.exports = { request, PanelError, isPanelConfigured, getServerUptime }
