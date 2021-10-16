import ThreeIdProvider from '3id-did-provider'
import { CeramicClient } from '@ceramicnetwork/http-client'
import { MongoClient, Db, Collection } from 'mongodb'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import ThreeIdResolver from '@ceramicnetwork/3id-did-resolver'
import { DID } from 'dids'
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
import { DocumentView, DocumentViewDto } from '../../api/resources/document.view'
import Crypto from 'crypto'
import base64url from 'base64url'

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

  constructor(readonly ceramic: CeramicClient, public readonly mongoClient: MongoClient) {
    const repoManager = new RepoManager(mongoClient)
    this.schemaValidator = new SchemaValidatorService(this.ceramic, repoManager)
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
   * @param streamId stream ID of ceramic document to retrieve and reindex
   */
  public async reindexDocument(streamId: string): Promise<DocumentViewDto> {
    const tileDoc = await TileDocument.load(this.ceramic, streamId)

    // TODO - figure out if we need a different method for the first time indexing a document vs reindexing a document
    // Possibly in the first time indexing document, build the graph index, and in the reindex, don't?
    const res = await this.graphDocs.findOneAndUpdate(
      {
        id: tileDoc.id.toString(),
      },
      {
        $set: {
          version_id: tileDoc.tip.toString(),
          last_updated: new Date(),
          last_pinged: new Date(),
          content: tileDoc.content,
        },
      },
    )

    return {
      streamId,
      parentId: res.value.parent_id,
      content: res.value.content,
      creatorId: tileDoc.controllers[0],
    }
  }

  /**
   * Basic method to get a list of IDs of child documents.
   * @param {String} id
   * @returns
   */
  async getChildrenIds(id) {
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
   * @todo Move API to client side only writes. Refactor current (centralized) test API.
   * @param {Object} content
   * @returns
   */
  async createPost(content, parent_id: string) {
    const permlink = base64url.encode(Crypto.randomBytes(6))
    const output = await TileDocument.create(
      this.ceramic,
      {
        parent_id: parent_id,
        content,
      },
      { tags: ['spk_network'], controllers: [this.ceramic.did.id] },
      { anchor: true, publish: false },
    )
    let dataRecord = await this.idx.get('rootPosts', this.ceramic.did.id)
    if (dataRecord) {
      dataRecord[permlink] = output.id.toUrl()
    } else {
      dataRecord = {
        [permlink]: output.id.toUrl(),
      }
    }
    await this.idx.set('rootPosts', dataRecord)
    await this.graphDocs.insertOne({
      id: output.id.toString(),
      content,
      created_at: new Date(),
      expire: null,
      first_seen: new Date(),
      last_updated: new Date(),
      last_pinged: new Date(),
      pinned: true,
      parent_id: parent_id,
    })
    return output.id.toString()
  }

  /**
   * @todo Move API to client side only writes. Refactor current (centralized) test API.
   * @param streamId
   * @param content
   * @returns
   */
  async updatePost(streamId, content) {
    const tileDoc = await TileDocument.load(this.ceramic, streamId)
    const curDoc = tileDoc.content
    curDoc['content'] = content
    await tileDoc.update(curDoc, null, { anchor: true })

    await this.graphDocs.findOneAndUpdate(
      {
        id: tileDoc.id.toString(),
      },
      {
        $set: {
          version_id: tileDoc.tip.toString(),
          last_updated: new Date(),
          last_pinged: new Date(),
        },
      },
    )
    return content
  }
  /**
   * Announces a BOGON to the network and deletes the post from the database
   * @todo Move API to client side only writes. Refactor current (centralized) test API.
   * @param streamId
   */
  async deletePost(streamId) {}

  /**
   * Retrives a post from the indexer.
   * Fetches the post from the network if unavailable.
   * @param {String} stream_id
   * @returns
   */
  async getPost(stream_id: string): Promise<DocumentView> {
    const cachedDoc = await this.graphDocs.findOne({ id: stream_id })
    if (cachedDoc) {
      return {
        creator_id: cachedDoc.creator_id,
        stream_id: cachedDoc.id,
        parent_id: cachedDoc.parent_id,
        content: cachedDoc.content,
      }
    } else {
      const tileDoc = await TileDocument.load(this.ceramic, stream_id)
      const creator_id = tileDoc.metadata.controllers[0]
      const nextContent = tileDoc.content

      let created_at
      const logHistory = tileDoc.state.log
      for (const logEntry of logHistory) {
        if (logEntry.type === 2) {
          created_at = new Date(logEntry.timestamp * 1000)
          break
        }
      }
      await this.graphDocs.insertOne({
        id: stream_id,
        parent_id: tileDoc.state.content.parent_id,
        content: nextContent,
        created_at,
        expire: null,
        first_seen: new Date(),
        last_updated: new Date(),
        last_pinged: new Date(),
        version_id: tileDoc.tip.toString(),
        creator_id: creator_id,
        pinned: false,
      })
      return {
        creator_id: creator_id,
        parent_id: tileDoc.state.content.parent_id,
        stream_id: stream_id,
        content: tileDoc.content,
      }
    }
  }
  /**
   * @param id The parent ID for which to retrive a list of child documents
   * @param skip The number of records to skip from the beginning of the results
   * @param limit The max number of records to return
   */
  async *getChildren(id: string, skip = 0, limit = 25): AsyncGenerator<DocumentView> {
    //todo: only transverse every few minutes and not on every request.
    void this.custodianSystem.transverseChildren(id)
    const data = this.graphIndex.find(
      {
        parent_id: id,
      },
      { skip, limit },
    )
    for await (const dataInfo of data) {
      const data = await this.getPost(dataInfo.id)
      yield data
    }
  }
  /**
   * @param creatorId The creator ID of the requested documents
   * @param skip The number of records to skip from the beginning of the results
   * @param limit The max number of records to return
   */
  async *getForUser(creatorId: string, skip = 0, limit = 25): AsyncGenerator<DocumentView> {
    // TODO - build logic to get user doc list from IDX
    const docIdsFromIdx: string[] = []

    for (const docId of docIdsFromIdx) {
      const data = await this.getPost(docId)
      yield data
    }
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
