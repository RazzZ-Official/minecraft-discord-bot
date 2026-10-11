// Persists whitelist requests and their decisions. Kept separate from data.json, which other features rewrite on timers.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const STORE_PATH = path.join(__dirname, '..', 'whitelist-requests.json')

const load = () => {
  if (!fs.existsSync(STORE_PATH)) return { requests: [] }
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
}

// Write to a temporary file first so a crash mid-write cannot corrupt the existing data.
const save = (data) => {
  const tempPath = `${STORE_PATH}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tempPath, STORE_PATH)
}

const getRequest = (id) => load().requests.find((request) => request.id === id)

const findPendingByUser = (userId) =>
  load().requests.find((request) => request.status === 'pending' && request.userId === userId)

const findPendingByName = (whitelistName) =>
  load().requests.find(
    (request) => request.status === 'pending' && request.whitelistName.toLowerCase() === whitelistName.toLowerCase()
  )

const createRequest = (fields) => {
  const data = load()
  const request = {
    id: crypto.randomBytes(6).toString('hex'),
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...fields,
  }
  data.requests.push(request)
  save(data)
  return request
}

const updateRequest = (id, changes) => {
  const data = load()
  const request = data.requests.find((entry) => entry.id === id)
  if (!request) return undefined
  Object.assign(request, changes)
  save(data)
  return request
}

const deleteRequest = (id) => {
  const data = load()
  data.requests = data.requests.filter((request) => request.id !== id)
  save(data)
}

module.exports = { getRequest, findPendingByUser, findPendingByName, createRequest, updateRequest, deleteRequest }
