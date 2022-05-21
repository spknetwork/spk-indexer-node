import { logger } from '../../../common/logger.singleton'
import { CoreService } from './core.service'

export class DatabaseMaintService {
  static async createIndexes(core: CoreService) {
    logger.info('Creating Mongo indexes...')
    try {
      await this.createPkIndexes(core)
    } catch (ex) {

    }
    try {
      await this.createDateIndexes(core)
    } catch (ex) {

    }

    logger.info('Finished creating Mongo indexes')
  }

  static async createPkIndexes(core: CoreService) {
    await core.graphDocs.createIndex(
      {
        id: 1,
      },
      { unique: true },
    )

    await core.graphIndex.createIndex({ id: 1 }, { unique: true })
  }

  static async createDateIndexes(core: CoreService) {
    await core.graphDocs.createIndex({
      created_at: -1,
    })

    await core.graphIndex.createIndex({
      first_seen: -1,
    })
  }
}
