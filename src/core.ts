import ThreeIdProvider from '3id-did-provider'
import { CeramicClient } from '@ceramicnetwork/http-client'
import Crypto from 'crypto'
import { MongoClient, Db, Collection } from 'mongodb'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import ThreeIdResolver from '@ceramicnetwork/3id-did-resolver'
import { DID } from 'dids'
import base64url from 'base64url'
import { CustodianSystem } from './custodianSystem'
import { IDX } from '@ceramicstudio/idx'
import { postSpider } from './postSpider'
import { SchemaValidator } from './modules/schema-validator/schema-validator.service'
import { MongoCollections, MONGO_DATABASE_NAME } from './modules/mongo-access/mongo.constants'
import { Document, ObjectId } from 'bson'

export class Core {
  ceramic: CeramicClient
  db: Db
  graphDocs: Collection<Document>
  graphIndex: Collection<Document>
  _threeId
  custodianSystem
  idx
  postSpider
  schemaValidator: SchemaValidator
  mongoClient: MongoClient

  constructor(ceramic: CeramicClient, mongo: MongoClient) {
    this.ceramic = ceramic
    this.mongoClient = mongo
    this.schemaValidator = new SchemaValidator(this.ceramic, this.mongoClient)
  }

  /**
   * Compiles graph index from list of stored graph docs.
   */
  async indexRefs() {
    const out = await this.graphDocs
      .find({
        parent_id: null,
      })
      .toArray()
    const outObj = {}
    const outArray = []
    for (const arg of out) {
      const argId = arg.id || arg._id
      const output = (
        await this.graphDocs
          .find({
            parent_id: arg.id,
          })
          .toArray()
      ).map((e) => e.id || e._id)

      outObj[argId] = output
      outArray.push({
        id: argId,
        children: output,
        expiration: null,
      })
      if (await this.graphIndex.findOne({ _id: arg.id })) {
        await this.graphIndex.findOneAndUpdate(
          { _id: arg.id },
          {
            $set: {
              children: outArray,
            },
          },
        )
      } else {
        await this.graphIndex.insertOne({
          _id: arg.id,
          children: output,
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
      streamId: output.id.toUrl(),
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
    const cachedDoc = await this.graphDocs.findOne({
      streamId,
    })
    if (cachedDoc) {
      return cachedDoc.content
    } else {
      const tileDoc = await TileDocument.load(this.ceramic, streamId)

      await this.graphDocs.insertOne({
        streamId,
        content: tileDoc.content,
        expire: null,
        updated_at: new Date(),
        last_checked: new Date(),
      })
      return tileDoc.content
    }
  }

  async start() {
    this.db = this.mongoClient.db(MONGO_DATABASE_NAME)

    this.graphDocs = this.db.collection(MongoCollections.GraphDocs)
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

    this.custodianSystem = new CustodianSystem(this)
    await this.custodianSystem.start()
    this.postSpider = new postSpider(this)
    await this.postSpider.start()
  }
}
