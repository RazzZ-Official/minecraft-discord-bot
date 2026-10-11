import fs from 'node:fs'
import path from 'node:path'

/** Folder for the bot's data files, next to package.json. */
export const DATA_DIR = path.resolve('datas')

/**
 * A list of records kept in memory and saved to datas/<name>.json.
 *
 * Reads and changes happen synchronously in memory, so a check followed by a change (eg. "no pending request yet,
 * so add one") cannot be interleaved with another change. Saving runs in the background, one write at a time,
 * through a temporary file that replaces the old one, so a crash never leaves a half-written file.
 */
export class JsonStore<T extends object> {
  private static readonly instances = new Set<JsonStore<object>>()

  /** Waits for every store's pending saves, eg. before the bot exits. */
  static flushAll(): Promise<void> {
    return Promise.allSettled([...JsonStore.instances].map((store) => store.flush())).then(() => undefined)
  }

  private readonly file: string
  private records: T[]
  private pendingWrite: Promise<void> = Promise.resolve()

  constructor(name: string) {
    this.file = path.join(DATA_DIR, `${name}.json`)
    this.records = this.load()
    JsonStore.instances.add(this)
  }

  all(): readonly T[] {
    return this.records
  }

  find(predicate: (record: T) => boolean): T | undefined {
    return this.records.find(predicate)
  }

  filter(predicate: (record: T) => boolean): T[] {
    return this.records.filter(predicate)
  }

  insert(record: T): Promise<T> {
    this.records.push(record)
    return this.save().then(() => record)
  }

  /** Changes the first matching record. Resolves to the updated record, or undefined if none matched. */
  update(predicate: (record: T) => boolean, changes: Partial<T>): Promise<T | undefined> {
    const index = this.records.findIndex(predicate)
    const current = this.records[index]
    if (!current) return Promise.resolve(undefined)
    const updated = { ...current, ...changes }
    this.records[index] = updated
    return this.save().then(() => updated)
  }

  /** Changes the matching record, or adds `record` when none matches. */
  upsert(predicate: (record: T) => boolean, record: T): Promise<T> {
    return this.records.some(predicate) ? this.update(predicate, record).then(() => record) : this.insert(record)
  }

  /** Removes every matching record. Resolves to how many were removed. */
  remove(predicate: (record: T) => boolean): Promise<number> {
    const before = this.records.length
    this.records = this.records.filter((record) => !predicate(record))
    const removed = before - this.records.length
    return removed ? this.save().then(() => removed) : Promise.resolve(0)
  }

  /** Waits until every change so far has been written. */
  flush(): Promise<void> {
    return this.pendingWrite
  }

  private load(): T[] {
    if (!fs.existsSync(this.file)) return []
    const parsed: unknown = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    if (!Array.isArray(parsed)) throw new Error(`${this.file} must contain a JSON array.`)
    return parsed as T[]
  }

  // Each save writes the latest records, after the previous save has finished. A failed save is reported to its
  // caller, and the next save still runs.
  private save(): Promise<void> {
    this.pendingWrite = this.pendingWrite
      .catch(() => undefined)
      .then(async () => {
        await fs.promises.mkdir(DATA_DIR, { recursive: true })
        const temporary = `${this.file}.tmp`
        await fs.promises.writeFile(temporary, `${JSON.stringify(this.records, null, 2)}\n`, 'utf8')
        await fs.promises.rename(temporary, this.file)
      })
    return this.pendingWrite
  }
}
