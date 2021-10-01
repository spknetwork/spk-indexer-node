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

export class CoreService {
  db: Db
  graphDocs: Collection<IndexedDocument>
  graphIndex: Collection<IndexedNode>
  _threeId
  custodianSystem: CustodianService
  idx
  postSpider: PostSpiderService
  schemaValidator: SchemaValidatorService

  constructor(private readonly ceramic: CeramicClient, private readonly mongoClient: MongoClient) {
    const repoManager = new RepoManager(mongoClient)
    this.schemaValidator = new SchemaValidatorService(this.ceramic, repoManager)
  }

  /**
   * Compiles graph index from list of stored graph docs.
   */
  async indexRefs() {
    const storedDocs = await this.graphDocs
      .find({
        parentId: null,
      })
      .toArray()

    const childDocArray = []

    for (const doc of storedDocs) {
      // Q for Vaultec - do we need to fall back on doc._id since streamId is required?
      //       const docId = doc.streamId || doc._id

      const childDocs = (
        await this.graphDocs
          .find({
            parentId: doc.id,
          })
          .toArray()
      ).map((child) => child.id)

      // Same question as above
      //       ).map((child) => child.streamId || child._id)

      childDocArray.push({
        id: doc.id,
        children: childDocs,
        expiration: null,
      })

      if (await this.graphIndex.findOne({ id: doc.id })) {
        await this.graphIndex.findOneAndUpdate(
          { id: doc.id },
          {
            $set: {
              children: childDocArray,
            },
          },
        )
      } else {
        await this.graphIndex.insertOne({
          _id: new ObjectId(),
          id: doc.id,
          children: childDocs,
          expiration: null,
          custodian_nodes: [],
        })
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
      parentId: id,
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
  async createPost(content) {
    const permlink = base64url.encode(Crypto.randomBytes(6))
    console.log(permlink)
    const output = await TileDocument.create(
      this.ceramic,
      {
        permlink,
        content,
      },
      { controllers: [this.ceramic.did.id] },
      { anchor: false, publish: false },
    )
    await this.graphDocs.insertOne({
      _id: new ObjectId(permlink),
      id: output.id.toUrl(),
      content,
      expire: null,
      updated_at: new Date(),
      last_checked: new Date(),
    })
    return output.id.toUrl()
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

      await this.graphDocs.insertOne({
        id: streamId,
        content: tileDoc.content,
        expire: null,
        updated_at: new Date(),
        last_checked: new Date(),
      })
      return tileDoc.content
    }
  }

  async start() {
    this.db = this.mongoClient.db(ConfigService.getConfig().mongoDatabaseName);

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
    await this.postSpider.start()
  }
}
