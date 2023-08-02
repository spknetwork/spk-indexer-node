import { logger } from '../../../common/logger.singleton'
import { ConfigService } from '../../../config.service'
import { CoreService } from './core.service'
import mongoose, { Schema } from 'mongoose'



const MONGO_HOST = ConfigService.getConfig().mongoHost
const MONGODB_URL = `mongodb://${MONGO_HOST}`

mongoose.connect(MONGODB_URL, {
  dbName: 'spk-indexer-test',
  autoIndex: true,
})

var GraphDocsSchema = new Schema()

GraphDocsSchema.index({
  id: 1
}, {
  unique: true
})

GraphDocsSchema.index({
  created_at: -1,
})

var GraphIndexSchema = new Schema()

GraphIndexSchema.index({
  id: 1
}, {
  unique: true
})

GraphIndexSchema.index({
  first_seen: -1,
})

var CAIPLinksSchema = new Schema()

CAIPLinksSchema.index({
  address: -1
}, {
  unique: true,
  
})

var PinsSchema = new Schema()

PinsSchema.index({
  value: 1,
  type: 1
}, {
  unique: true
})


var ConnectionSchema = new Schema()

ConnectionSchema.index({
  follower: 1,
  following: 1
}, {
  unique: true
})


const Models = {
  GraphDocsSchema: mongoose.model('graphDocs', GraphDocsSchema),
  GraphIndexSchema: mongoose.model('graphIndex', GraphIndexSchema),
  CAIPLinks: mongoose.model('caip10_links', CAIPLinksSchema),
  PinsSchema: mongoose.model('pins', PinsSchema),
  ConnectionSchema: mongoose.model('social_connections', ConnectionSchema),

  // FollowsModel: mongoose.model('follows', follows),
  // DelegatedAuthorityModel: mongoose.model('delegated-authority', delegatedAuthority),
}



export class DatabaseMaintService {
  static async createIndexes(core: CoreService) {
    logger.info('Creating Mongo indexes...')

    try {
      for(let model of Object.values(Models)) {
        await model.syncIndexes()
      }
    } catch (ex) {
      console.log(ex)
    }
    logger.info('Finished creating Mongo indexes')
  }
}
