import { Collection, ObjectId } from 'mongodb'
import { CoreService } from './core.service'
import { OplogEntry } from '../graph-indexer.model'

/**
 * TODO: create a websocket API for instaneous receiving of DB events
 */
export class OplogService {
  self: CoreService
  oplog: Collection<OplogEntry>
  constructor(self: CoreService) {
    this.self = self

    this.oplog = this.self.db.collection<OplogEntry>('oplog')
  }
  async insertEntry(entry: OplogEntry) {
    await this.oplog.insertOne(entry)
  }
  async getEntries(pagination_id: string) {
    const array = (
      await this.oplog
        .find(
          {
            ...(pagination_id ? { _id: { $gt: new ObjectId(pagination_id) } } : {}),
          },
          {
            limit: 100,
          },
        )
        .toArray()
    ).map((e) => {
      return {
        ...e,
        date: e.date.toISOString(),
      }
    })
    if (array.length === 0) {
      return {
        pagination_id: null,
        items: [],
        count: 0,
      }
    }
    const lastEntry = array[array.length - 1]
    const lastPagination = lastEntry._id
    return {
      pagination_id: lastPagination,
      items: array,
      count: array.length,
    }
  }
}
