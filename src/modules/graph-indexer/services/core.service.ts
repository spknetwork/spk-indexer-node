import ThreeIdProvider from '3id-did-provider'
import { CeramicClient } from '@ceramicnetwork/http-client'
import Crypto from 'crypto'
import { MongoClient, Db, Collection } from 'mongodb'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import ThreeIdResolver from '@ceramicnetwork/3id-did-resolver'
import { DID } from 'dids'
import base64url from 'base64url'
import { IDX } from '@ceramicstudio/idx'
import { ObjectId } from 'bson'
import { CustodianService } from './custodian.service'
import { PostSpiderService } from './post-spider.service'
import { RepoManager } from '../../mongo-access/services/repo-manager.service'
import { SchemaValidatorService } from '../../schema-validator/services/schema-validator.service'
import { ConfigService } from '../../../config.service'
import { IndexedDocument, IndexedNode } from '../graph-indexer.model'
import { MongoCollections } from '../../mongo-access/mongo-access.model'
import { BloomFilter } from 'bloom-filters'

export class CoreService {
  db: Db
  graphDocs: Collection<IndexedDocument>
  graphIndex: Collection<IndexedNode>
  _threeId
  custodianSystem: CustodianService
  idx
  postSpider: PostSpiderService
  schemaValidator: SchemaValidatorService

  constructor(readonly ceramic: CeramicClient, private readonly mongoClient: MongoClient) {
    const repoManager = new RepoManager(mongoClient)
    this.schemaValidator = new SchemaValidatorService(this.ceramic, repoManager)
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
   * Basic method to get a list of IDs of child documents.
   * @param {String} id
   * @returns
   */
  async getChildren(id) {
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

  /**
   * Creates a post on the indexer.
   * @param {Object} content
   * @returns
   */
  async createPost(content, parent_id: string) {
    const permlink = base64url.encode(Crypto.randomBytes(6))
    console.log(permlink)
    const output = await TileDocument.create(
      this.ceramic,
      {
        parent_id: parent_id,
        content,
      },
      { controllers: [this.ceramic.did.id] },
      { anchor: false, publish: false },
    )
    await this.graphDocs.insertOne({
      id: output.id.toString(),
      content,
      expire: null,
      first_seen: new Date(),
      last_updated: new Date(),
      last_pinged: new Date(),
      pinned: true,
      parent_id,
    })
    return output.id.toString()
  }

  /**
   * Retrives a post from the indexer.
   * Fetches the post from the network if unavailable.
   * @param {String} streamId
   * @returns
   */
  async getPost(streamId) {
    const cachedDoc = await this.graphDocs.findOne({ id: streamId })
    if (cachedDoc) {
      return cachedDoc.content
    } else {
      const tileDoc = await TileDocument.load(this.ceramic, streamId)
      const creator_id = tileDoc.metadata.controllers[0]
      const nextContent = tileDoc.content
      console.log(tileDoc.state.content)
      await this.graphDocs.insertOne({
        id: streamId,
        parent_id: tileDoc.state.content.parent_id,
        content: nextContent,
        expire: null,
        first_seen: new Date(),
        last_updated: new Date(),
        last_pinged: new Date(),
        versionId: tileDoc.tip.toString(),
        creator_id,
        pinned: false,
      })
      return tileDoc.content
    }
  }
  async *getDiscussion(id: string) {
    void this.custodianSystem.transverseChildren(id)
    const data = this.graphIndex.find({
      parent_id: id,
    })
    for await (const dataInfo of data) {
      const data = await this.getPost(dataInfo.id)
      yield {
        content: data,
      }
    }
  }
  async createBloom(parent_id: string) {
    const items = (
      await this.graphIndex
        .find({
          parent_id,
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
    this.db = this.mongoClient.db(ConfigService.getConfig().mongoDatabaseName)

    this.graphDocs = this.db.collection(MongoCollections.IndexedDocs)
    this.graphIndex = this.db.collection(MongoCollections.GraphIndex)

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
    console.log(this._threeId.getDidProvider())
    console.log(did.id)
    this.idx = new IDX({
      ceramic: this.ceramic,
    })

    this.custodianSystem = new CustodianService(this)
    await this.custodianSystem.start()
    this.postSpider = new PostSpiderService(this)
    //;(await this.postSpider.start()) *
    //void this.indexRefs()
    /*void this.createPost(
      {
        title: 'very cool! Title! Yes!',
        description: 'Another amazing test post!',
      },
      'kjzl6cwe1jw14b57249n2ujjkiiucpdw9dic9rotvk2m1tlfbmoeo7ccwkz94ho',
    )*/
    //void this.createBloom('kjzl6cwe1jw14b57249n2ujjkiiucpdw9dic9rotvk2m1tlfbmoeo7ccwkz94ho')
  }
}
