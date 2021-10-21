import { logger } from '../../../common/logger.singleton'
import { CoreService } from './core.service'

export class DatabaseMaintService {
  static async createIndexes(core: CoreService) {
    await core.graphDocs.createIndex(
      {
        id: 1,
      },
      { unique: true },
    )

    await core.graphIndex.createIndex({ id: 1 }, { unique: true })

    logger.info('Mongo indexes initialized')
  }
}
