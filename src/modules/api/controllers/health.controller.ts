import { Controller, Get, InternalServerErrorException } from '@nestjs/common'
import { indexerContainer, ipfsContainer } from '../indexer-api.module'
const IPFS_PUBSUB_TOPIC = '/spk.network/testnet-dev'
import _ from 'lodash'

// Need to keep a top-level container here to avoid garbage collection
// @Controller(`${INDEXER_API_BASE_URL}/debug`)
@Controller(`/api/v0/node/health`)
export class HealthApiController {
  constructor() {}

  @Get('')
  async getDebugSummaryInfo() {
    try {
      const ipfsStats = ipfsContainer.self.repo.stat({ human: true } as any)
      const mongoStatsAll = await indexerContainer.self.db.stats()
      const docsCollectionStatsAll = await indexerContainer.self.graphDocs.stats()
      const mongoStorageMb = _.round(mongoStatsAll.storageSize / 1000000, 3)
      const docsStorageMb = _.round(docsCollectionStatsAll.storageSize / 1000000, 3)

      return {
        mongoStorageMb,
        docsStorageMb,
        ipfsStats,
        mongoStatsAll,
        docsCollectionStatsAll,
      }
    } catch (err) {
      console.error(`error getting health info!`, err.message)
      throw new InternalServerErrorException(`Error getting health info! ${err.message}`)
    }
  }
}
