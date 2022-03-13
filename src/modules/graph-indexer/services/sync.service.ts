import { BloomFilter } from 'bloom-filters'
import { Collection, Filter } from 'mongodb'
import { IndexedDocument } from '../graph-indexer.model'
import { CoreService } from './core.service'

interface BloomField {
  field: string
  value: string
  selector: any
  bf: string
}
interface BloomFieldPayload extends BloomField {
  type: string
}

/**
 * Simple service to redundantly sync the data across multiple nodes for maximum redundancy
 */
export class SyncService {
  self: CoreService
  graphDocs: Collection<IndexedDocument>
  constructor(self: CoreService) {
    this.self = self
  }
  async remoteFind(query: any) {
    const data = await this.graphDocs.distinct('id', query as Filter<any>)
    console.log(data)
    const blk = BloomFilter.from(data, 0.001)

    const payload: BloomFieldPayload = {
      type: 'ask_bloom_field',
      field: '',
      value: '',
      selector: query,
      bf: blk.saveAsJSON(),
    }
    console.log(payload)
  }
  async start() {
    this.graphDocs = this.self.graphDocs
    await this.remoteFind({})
  }
}
