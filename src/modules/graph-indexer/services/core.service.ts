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
import { ConfigService, NULL_DID } from '../../../config.service'
import { IndexedDocument, IndexedNode } from '../graph-indexer.model'
import { MongoCollections } from '../../mongo-access/mongo-access.model'
import BloomFilters from 'bloom-filters'
import { DocCacheService } from './doc-cache.service'
import { DatabaseMaintService } from './database-maint.service'
import { logger } from '../../../common/logger.singleton'
import { Config } from './config.service'
import path from 'path'
import os from 'os'
import { IdentityService } from './identity.service'
import { OplogService } from './oplog.service'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import { SyncService } from './sync.service'
import { ProfilesService } from './profiles.service'
import { CAIP10Service } from './caip10.service'
import { PinManager } from './pin-manager.service'
import { SocialConnections } from './social-graph/social-connections'
import { CeramicSigner } from '@ceramicnetwork/common'
import * as dagCbor from '@ipld/dag-cbor'
const {BloomFilter} = BloomFilters


const idxAliases = {
  rootPosts: 'ceramic://kjzl6cwe1jw149xy2w2qycwts4xjpvyzrkptdw20iui7r486bd6sasqb9tgglzp',
  'socialConnectionIndex': 'ceramic://kjzl6cwe1jw145f1327br2k7lkd5acrn6d2omh88xjt70ovnju491moahrxddns'
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
  oplogService: OplogService
  sync: SyncService
  graphProfiles: any
  ceramicProfiles: any
  cacheMisc: any
  profileService: ProfilesService
  caipService: CAIP10Service
  pins: PinManager
  socialConnections: SocialConnections

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
      ceramic: this.ceramic as any,
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
    this.caipService = new CAIP10Service(this);

    this.socialConnections = new SocialConnections(this)
    await this.socialConnections.start()

    this.pins = new PinManager(this)
    await this.pins.start()

    // const permlink = await this.docCacheService.resolvePermlink('kjzl6cwe1jw149jbqnz49pwlbdqi30ouvk22m35lagy6jir2gt9pj922srms505')
    // console.log(permlink)
    
    
    /*const commit = await TileDocument.makeGenesis(this.ceramic, {
      type: 'test',
      owner: 'eddiespino',
      permlink: 'pfdpnsvp'
    }, {
      
      deterministic: true
    })
    const tilDoc = await this.ceramic.createStreamFromGenesis<TileDocument>(
      TileDocument.STREAM_TYPE_ID,
      commit,
      {
        //syncTimeoutSeconds: 0
      }
    )*/

    // const tileDoc = await TileDocument.create(this.ceramic, null, {
    //   tags: ["hello world this is a test!"],
    //   deterministic: true,
    //   controllers: [NULL_DID]
    // })

    // const header = {
    //   special_content: {
    //     type: 'test',
    //     owner: 'eddiespino',
    //     permlink: 'pfdpnsvp'
    //   },
    //   tags: ['test'],
    //   deterministic: true,
    //   controllers: [NULL_DID]
    // }
    // const result = { header }
    // dagCbor.encode(result)

    // const commit = dagCbor.encode(result)
    // console.log(commit, result)
    // const tileDoc2 = await this.ceramic.createStreamFromGenesis<TileDocument>(
    //   TileDocument.STREAM_TYPE_ID,
    //   result,
      
    // )
    // console.log('genesis with metadata', tileDoc2.id)
    //Leave for later when doing upvotes/downvotes
    /*const tilDoc2 = await TileDocument.createFromGenesis(this.ceramic, {
      header: {
        controllers: []
      },
      data: {
        type: 'test',
        owner: 'eddiespino',
        permlink: 'pfdpnsvp'
      }
    })*/
   
    // console.log('genesis test', tileDoc.id, )
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
        title: 'Test post to see if ceramic api is working properly',
        body: 'child of kjzl6cwe1jw147nu8nkdx3stc4ztf8e3u6h5l5s54vbsyjfgmgt17flr895ugso',
      },
      'kjzl6cwe1jw147nu8nkdx3stc4ztf8e3u6h5l5s54vbsyjfgmgt17flr895ugso',
    )*/
    try {
      /*const indexedStuff = await this.graphIndex.find({}).toArray()
      for (const idstuff of indexedStuff) {
        await this.docCacheService.refreshCachedDoc(idstuff.id)
      }*/
    } catch (ex) {
      console.log(ex)
    }
    setInterval(async () => {
      try {
        const indexedStuff = await this.graphIndex.find({}).toArray()
        for (const idstuff of indexedStuff) {
          await this.docCacheService.refreshCachedDoc(idstuff.id)
        }
      } catch {}
    }, 300 * 1000)
  }
}
