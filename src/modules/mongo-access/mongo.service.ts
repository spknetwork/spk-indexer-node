import { MongoClient } from 'mongodb'

/**
 * A convenience wrapper around the mongo client
 */
export class MongoService {
  client: MongoClient
  constructor(mongo: MongoClient) {
    this.client = mongo
  }
}
