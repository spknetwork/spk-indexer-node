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

const idxAliases = {
  rootPosts: 'ceramic://kjzl6cwe1jw147fikhkjs9qysmv6dkdsu5i6zbgk4x9p47gt9uedru1755y76dg',
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
    if ([].length === 0) {
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
    await DatabaseMaintService.createIndexes(this)

    this._threeId = await ThreeIdProvider.create({
      ceramic: this.ceramic,
      did: 'did:3:kjzl6cwe1jw147v2fzxjvpbvjp87glksoi2p698t6bbhuv2cuc3vie7kcopvyfb',
      // Seed is randomly generated so we can safely expose it publicly.
      seed: Uint8Array.from([
        86, 151, 157, 124, 159, 113, 140, 212, 127, 91, 246, 26, 219, 239, 93, 63, 129, 86, 224,
        171, 246, 28, 8, 4, 188, 0, 114, 194, 151, 239, 176, 253,
      ]),
      getPermission: (request) => {
        return request.payload.paths
      },
    })

    const did = new DID({
      provider: this._threeId.getDidProvider(),
      resolver: ThreeIdResolver.getResolver(this.ceramic),
    })
    await did.authenticate()
    await this.ceramic.setDID(did)
    logger.info(`Node DID: ${did.id}`)
    this.idx = new IDX({
      autopin: true,
      ceramic: this.ceramic,
      aliases: idxAliases,
    })

    this.custodianSystem = new CustodianService(this)
    await this.custodianSystem.start()
    this.postSpider = new PostSpiderService(this)
    /*await this.postSpider.start()
    await this.postSpider.pullSingle(
      'did:3:kjzl6cwe1jw147v2fzxjvpbvjp87glksoi2p698t6bbhuv2cuc3vie7kcopvyfb',
    )*/
    //;(await this.postSpider.start()) *
    //void this.indexRefs()
    /*void this.createPost(
      {
        title: 'Test post with permlink',
        description: 'Test post with permlink',
      },
      'kjzl6cwe1jw14b57249n2ujjkiiucpdw9dic9rotvk2m1tlfbmoeo7ccwkz94ho',
    )*/
    //void this.createBloom('kjzl6cwe1jw14b57249n2ujjkiiucpdw9dic9rotvk2m1tlfbmoeo7ccwkz94ho')
    //this.procSync()
  }
}
