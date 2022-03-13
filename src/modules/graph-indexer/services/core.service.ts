import ThreeIdProvider from '3id-did-provider'
import { CeramicClient } from '@ceramicnetwork/http-client'
import { MongoClient, Db, Collection } from 'mongodb'
import ThreeIdResolver from '@ceramicnetwork/3id-did-resolver'
import { DID } from 'dids'
import { IDX } from '@ceramicstudio/idx'
import { ObjectId } from 'bson'
import { CustodianService } from './custodian.service'
import { PostSpiderService } from './post-spider.service'
import { SchemaValidatorService } from '../../schema-validator/services/schema-validator.service'
import { ConfigService } from '../../../config.service'
import { IndexedDocument, IndexedNode } from '../graph-indexer.model'
import { MongoCollections } from '../../mongo-access/mongo-access.model'
import { BloomFilter } from 'bloom-filters'
import { DocCacheService } from './doc-cache.service'
import { DatabaseMaintService } from './database-maint.service'
import { logger } from '../../../common/logger.singleton'
import { Config } from './config.service'
import path from 'path'
import os from 'os'
import { IdentityService } from './identity.service'

const idxAliases = {
  rootPosts: 'ceramic://kjzl6cwe1jw149xy2w2qycwts4xjpvyzrkptdw20iui7r486bd6sasqb9tgglzp',
}
export class CoreService {
  db: Db
  graphDocs: Collection<IndexedDocument>
  graphIndex: Collection<IndexedNode>
  _threeId
  custodianSystem: CustodianService
  idx: IDX
  postSpider: PostSpiderService
  schemaValidator: SchemaValidatorService
  docCacheService: DocCacheService
  config: Config
  nodeIdentity: IdentityService

  constructor(readonly ceramic: CeramicClient, public readonly mongoClient: MongoClient) {
    this.db = this.mongoClient.db(ConfigService.getConfig().mongoDatabaseName)
    this.docCacheService = new DocCacheService(ceramic, this)
  }

  public async getAllIndexes() {
    return await this.graphIndex.find().toArray()
  }

  public async getAllDocuments() {
    return await this.graphDocs.find().toArray()
  }

  /**
   * Compiles graph index from list of stored graph docs.
   */
  async indexRefs() {
    const storedDocs = await this.graphDocs
      .find({
        parent_id: null,
      })
      .toArray()

    for (const doc of storedDocs) {
      const childDocs = await this.graphDocs
        .find({
          parent_id: doc.id,
        })
        .toArray()
      for (const childDoc of childDocs) {
        if (await this.graphIndex.findOne({ id: childDoc.id })) {
          await this.graphIndex.findOneAndUpdate(
            { id: childDoc.id },
            {
              $set: {
                last_pinged: new Date(),
              },
            },
          )
        } else {
          await this.graphIndex.insertOne({
            _id: new ObjectId(),
            id: childDoc.id,
            parent_id: doc.id,
            expiration: null,
            first_seen: new Date(),
            last_pinged: new Date(),
            last_pulled: new Date(),
          })
        }
      }
    }
  }

  /**
   * @description Create a node in the graph index for a new document
   */
  public async initGraphIndexNode(streamId: string, parentId?: string) {
    await this.graphIndex.insertOne({
      _id: new ObjectId(),
      id: streamId,
      parent_id: parentId,
      expiration: null,
      first_seen: new Date(),
      last_pinged: new Date(),
      last_pulled: new Date(),
    })
  }

  /**
   * Basic method to get a list of IDs of child documents.
   * @param {String} id
   * @returns
   */
  async getDocChildrenIds(id) {
    const docs = this.graphDocs.find({
      parent_id: id,
    })

    console.log(docs)
    const out = []
    for await (const entry of docs) {
      out.push(entry._id)
    }
    return out
  }

  async procSync() {
    const dataDocs = await this.graphDocs
      .find({
        $or: [
          {
            last_pinged: {
              $lte: new Date(new Date().getTime() - 1 * 60 * 60 * 1000), //last hour
            },
          },
          {
            last_pinged: {
              $exists: false,
            },
          },
        ],
      })
      .toArray()
    const mutltiQuery = dataDocs.map((e) => ({
      streamId: e.id,
    }))
    const multiResult = await this.ceramic.multiQuery(mutltiQuery)
    for (const doc of dataDocs) {
      const tileDoc = multiResult[doc.id]
      if (doc.version_id !== tileDoc.tip.toString()) {
        let lastUpdated
        if (tileDoc.state.anchorProof) {
          const anchorProof = tileDoc.state.anchorProof
          lastUpdated = new Date(anchorProof.blockTimestamp * 1000)
        }
        await this.graphDocs.findOneAndUpdate(
          {
            _id: doc._id,
          },
          {
            $set: {
              version_id: multiResult[doc.id].tip.toString(),
              content: multiResult.content,
              last_pinged: new Date(),
              last_updated: lastUpdated,
            },
          },
        )
      } else {
        await this.graphDocs.findOneAndUpdate(
          {
            _id: doc._id,
          },
          {
            $set: {
              last_pinged: new Date(),
            },
          },
        )
      }
    }
  }
  async createBloom(parent_id: string) {
    const items = (
      await this.graphIndex
        .find({
          parent_id: parent_id,
        })
        .toArray()
    ).map((e) => e.id)
    if (items.length === 0) {
      return null
    }
    const bloom = BloomFilter.from(items, 0.001)
    return bloom
  }

  async start() {
    logger.info(`Starting core service...`)

    // Init collections and indexes
    this.graphDocs = this.db.collection(MongoCollections.IndexedDocs)
    this.graphIndex = this.db.collection(MongoCollections.GraphIndex)
    this.ceramicProfiles = this.db.collection('ceramic_profiles')
    this.cacheMisc = this.db.collection('misc_cache')
    await DatabaseMaintService.createIndexes(this)

    this.config = new Config(path.join(os.homedir(), '.spk-indexer-node'))
    await this.config.open()

    this.nodeIdentity = new IdentityService(this)
    await this.nodeIdentity.start()
    this.idx = new IDX({
      autopin: true,
      ceramic: this.ceramic,
      aliases: idxAliases,
    })
    logger.info(`Node DID: ${this.nodeIdentity.identity.id}`)
    this.profileService = new ProfilesService(this)

    //await this.indexRefs()

    /*const bloom = await this.createBloom(
      'kjzl6cwe1jw147nu8nkdx3stc4ztf8e3u6h5l5s54vbsyjfgmgt17flr895ugso',
    )*/

    this.custodianSystem = new CustodianService(this)
    await this.custodianSystem.start()
    this.postSpider = new PostSpiderService(this)
    this.oplogService = new OplogService(this)
    this.sync = new SyncService(this)
    await this.sync.start()

    /*const testDoc = await TileDocument.load(
      this.ceramic,
      'kjzl6cwe1jw146b542t7glg35xnpbx781trjk4hm73dbqazdg4kjd6u0oj4cf2h',
    )
    await testDoc.update({
      title: 'Different title',
      body: 'Different body! Changed even more.',
    })*/
    /*await this.docCacheService.createDocument(
      {
        title: 'this is a title of body post! children',
        body: 'child of kjzl6cwe1jw147nu8nkdx3stc4ztf8e3u6h5l5s54vbsyjfgmgt17flr895ugso',
      },
      'kjzl6cwe1jw147nu8nkdx3stc4ztf8e3u6h5l5s54vbsyjfgmgt17flr895ugso',
    )*/
    await this.indexRefs()

    const bloom = await this.createBloom(
      'kjzl6cwe1jw147nu8nkdx3stc4ztf8e3u6h5l5s54vbsyjfgmgt17flr895ugso',
    )

    this.custodianSystem = new CustodianService(this)
    await this.custodianSystem.start()
    this.postSpider = new PostSpiderService(this)
  }
}
