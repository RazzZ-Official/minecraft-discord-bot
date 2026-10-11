import mongoose from 'mongoose'
import type { Logger } from './Logger.js'

export class Database {
  constructor(
    private readonly uri: string,
    private readonly logger: Logger
  ) {}

  async connect(): Promise<void> {
    await mongoose.connect(this.uri, { serverSelectionTimeoutMS: 10_000 })
    // Builds the indexes declared in the schemas, such as the duplicate-request guards.
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()))
    this.logger.info(`Connected to MongoDB (${mongoose.connection.name}).`)
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect()
  }
}
