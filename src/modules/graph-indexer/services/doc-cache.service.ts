import CeramicClient from '@ceramicnetwork/http-client'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import { IDX_ROOT_DOCS_KEY } from '../../../common/constants'
import { DocumentView, DocumentViewDto } from '../../api/resources/document.view'
import { UserDocumentViewDto } from '../../api/resources/user-document.view'
import { CeramicDocContent, DocSortOption } from '../graph-indexer.model'
import { CoreService } from './core.service'
import { differenceInMinutes } from 'date-fns'
import { Span } from '@opentelemetry/api'
import { logger } from '../../../common/logger.singleton'
import Crypto from 'crypto'
import base64url from 'base64url'

export class DocCacheService {
  constructor(private readonly ceramic: CeramicClient, private readonly core: CoreService) {}

  /**
   * @description Refresh a cached doc that already exists
   * @param streamId stream ID of the doc to refresh in the index
   */
  public async refreshCachedDoc(streamId: string) {
    const tileDoc = await TileDocument.load<DocumentView>(this.ceramic, streamId)

    const data = await this.core.graphDocs.findOne({
      id: streamId,
    })
    if (data) {
      if (data.version_id !== tileDoc.tip.toString()) {
        //Provides more clarity on the order at which updates occurred
        const state_counter = tileDoc.state.log.map(e => e.cid.toString()).indexOf(tileDoc.tip.toString());
        void this.core.oplogService.insertEntry({
          type: 'UPDATE',
          stream_id: streamId,
          date: new Date(),
          meta: {
            state_counter,
            version_id: tileDoc.tip.toString(),
          },
        })
        //TODO: Prevent tip head hash from going backwards..
        //Bug with Ceramic where the state goes backwards depending on network conditions.
        await this.core.graphDocs.findOneAndUpdate(
          {
            id: streamId,
          },
          {
            $set: {
              version_id: tileDoc.tip.toString(),
              last_updated: new Date(),
              last_pinged: new Date(),
              content: tileDoc.content.content,
              updated_at: tileDoc.content.updated_at,
            },
          },
        )
      } else {
        await this.core.graphDocs.findOneAndUpdate(data, {
          $set: {
            last_pinged: new Date(),
          },
        })
      }
    }
  }

  /**
   * @description Cache a doc that has not been cached before
   * @param streamId stream ID of ceramic document to initialize in the cache
   */
  public async initializeCachedDoc(streamId: string, span: Span): Promise<void> {
    const tileDoc = await TileDocument.load<DocumentView>(this.ceramic, streamId)

    // Assign creator ID as the first controller on the document
    const creatorId = tileDoc.controllers[0]

    await this.core.graphDocs.insertOne({
      id: streamId,
      content: tileDoc.content.content,
      created_at: new Date(tileDoc.content.created_at),
      updated_at: new Date(tileDoc.content.updated_at),
      expire: null,
      first_seen: new Date(),
      last_updated: new Date(),
      last_pinged: new Date(),
      pinned: true,
      parent_id: tileDoc.content.parent_id,
      version_id: tileDoc.tip.toString(),
      creator_id: creatorId,
      type: 'LINKED_DOC',
    })

    const state_counter = tileDoc.state.log.map(e => e.cid.toString()).indexOf(tileDoc.tip.toString());
    
    void this.core.oplogService.insertEntry({
      type: state_counter === 0 ? 'CREATE' : 'UPDATE',
      stream_id: streamId,
      date: new Date(),
      meta: {
        state_counter,
        version_id: tileDoc.tip.toString(),
      },
    })

    await this.core.custodianSystem.announceCreation({
      headers: {
        creator_id: creatorId,
        namespace: tileDoc.content.app,
        parent_id: tileDoc.content.parent_id,
      },
      stream_id: streamId,
    })
    span.addEvent('inserted_graph_doc')

    await this.core.initGraphIndexNode(streamId, tileDoc.content.parent_id)
    span.addEvent('inserted_graph_index')
  }

  /**
   * @param creatorId The creator ID of the requested documents
   * @param skip The number of records to skip from the beginning of the results
   * @param limit The max number of records to return
   * @returns a map of doc permlinks to documents for docs that belong to the specified user id
   */
  async *getDocsForUser(
    creatorId: string,
    skip = 0,
    limit = 25,
    sort: DocSortOption = DocSortOption.createddesc,
  ): AsyncGenerator<DocumentViewDto> {
    const cursor = this.core.graphDocs.find(
      {
        creator_id: creatorId,
      },
      {
        skip,
        limit,
        sort: this.getMongoSortOption(sort),
      },
    )
    for await (const doc of cursor) {
      yield DocumentViewDto.fromIndexedDocument(doc)
    }
  }

  /**
   * @param doc_id The parent ID for which to retrive a list of child documents
   * @param skip The number of records to skip from the beginning of the results
   * @param limit The max number of records to return
   */
  async *getDocChildren(
    doc_id: string,
    skip = 0,
    limit = 25,
    sort: DocSortOption = DocSortOption.createddesc,
  ): AsyncGenerator<DocumentViewDto> {
    this.core.custodianSystem.transverseChildren(doc_id).catch((e) => console.log(e))
    const indexedChildren = await this.core.graphIndex
      .find({
        parent_id: doc_id,
      })
      .toArray()

    for (const child of indexedChildren) {
      if (
        !(await this.core.graphDocs.findOne({
          id: child.id,
        }))
      ) {
        await this.getDocument(child.id)
      }
    }

    const cursor = this.core.graphDocs.find(
      {
        parent_id: doc_id,
      },
      {
        skip,
        limit,
        sort: this.getMongoSortOption(sort),
      },
    )
    for await (const doc of cursor) {
      yield DocumentViewDto.fromIndexedDocument(doc)
    }
  }

  // May want to eliminate this function
  async *getDocsForUserFromIdx(
    creatorId: string,
    skip = 0,
    limit = 25,
  ): AsyncGenerator<UserDocumentViewDto> {
    const linksFromIdx: Record<string, string> = await this.core.idx.get(
      IDX_ROOT_DOCS_KEY,
      creatorId,
    )
    const permlinks = Object.keys(linksFromIdx || {}).slice(skip, skip + limit)

    for (const permlink of permlinks) {
      const data = await this.getDocument(linksFromIdx[permlink])
      const view = UserDocumentViewDto.fromDocumentView(data, permlink)
      yield view
    }
  }

  /**
   * Retrives a post from the indexer.
   * Fetches the post from the network if unavailable.
   * @param {String} stream_id
   * @returns the requested document
   */
  async getDocument(stream_id: string, span?: Span): Promise<DocumentView> {
    const cachedDoc = await this.core.graphDocs.findOne({ id: stream_id })
    if (cachedDoc) {
      if (span) {
        span.addEvent('return_cached_doc')
      }
      return {
        creator_id: cachedDoc.creator_id,
        stream_id: cachedDoc.id,
        parent_id: cachedDoc.parent_id,
        content: cachedDoc.content,
        created_at: cachedDoc.created_at,
        updated_at: cachedDoc.updated_at,
      }
    } else {
      if (span) {
        span.addEvent('retrieve_and_cache_doc')
      }
      const tileDoc = await TileDocument.load<CeramicDocContent>(this.ceramic, stream_id)
      const creator_id = tileDoc.metadata.controllers[0]
      const nextContent = (tileDoc.content as any).content

      await this.core.graphDocs.insertOne({
        id: stream_id,
        parent_id: tileDoc.state.content.parent_id,
        content: nextContent,
        created_at: new Date(tileDoc.state.content.created_at),
        updated_at: new Date(tileDoc.state.content.updated_at),
        expire: null,
        first_seen: new Date(),
        last_updated: new Date(),
        last_pinged: new Date(),
        version_id: tileDoc.tip.toString(),
        creator_id: creator_id,
        pinned: false,
        type: 'LINKED_DOC',
      })
      await this.core.oplogService.insertEntry({
        type: 'CREATE',
        stream_id: stream_id,
        date: new Date(),
        meta: {
          state_counter: 0,
          version_id: tileDoc.tip.toString(),
        },
      })
      return {
        creator_id: creator_id,
        parent_id: tileDoc.state.content.parent_id,
        stream_id: stream_id,
        content: (tileDoc.content as any).content, //this is probably not safe longterm.
        created_at: tileDoc.state.content.created_at,
        updated_at: tileDoc.state.content.updated_at,
      }
    }
  }

  /**
   * Announces a BOGON to the network and deletes the post from the database
   * @todo Move API to client side only writes. Refactor current (centralized) test API.
   * @param streamId
   */
  async deleteDocument(streamId: string) {}

  public async docCreateTimestampIsValid(stream_id: string, created_at: string): Promise<boolean> {
    const tileDoc = await TileDocument.load<CeramicDocContent>(this.ceramic, stream_id)

    if (!tileDoc) {
      logger.error(`Could not retrieve doc with stream ID ${stream_id}`)
    }

    let created_at_from_log
    const logHistory = tileDoc.state.log
    for (const logEntry of logHistory) {
      if (logEntry.type === 2) {
        created_at_from_log = new Date(logEntry.timestamp * 1000)
        break
      }
    }

    if (!created_at_from_log) {
      console.error(`Log history: `, logHistory)
      throw new Error(
        `Could not obtain creation time from ceramic log for doc stream ID ${stream_id}. Log entry count in ceramic: ${logHistory.length}`,
      )
    }

    try {
      const diff = differenceInMinutes(new Date(created_at), created_at_from_log)
      if (Math.abs(diff) <= 60) {
        return true
      } else {
        logger.warn(
          `Validating doc stream ID ${stream_id} against created_at date in document... validation failed.  Variation in minutes: ${Math.abs(
            diff,
          )}`,
        )
        return false
      }
    } catch (err) {
      throw new Error(`Error validating ceramic document created_at date ${err.message}`)
    }
  }

  /**
   * @todo Move API to client side only writes. Refactor current (centralized) test API.
   * @param streamId
   * @param content
   * @returns
   */
  async updateDocument(streamId, content) {
    const tileDoc = await TileDocument.load<CeramicDocContent>(this.ceramic, streamId)
    const curDoc = tileDoc.content
    curDoc['content'] = content
    await tileDoc.update(curDoc, null, { anchor: true })

    await this.core.graphDocs.findOneAndUpdate(
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
   * Creates a post on the indexer.
   * @todo Move API to client side only writes. Refactor current (centralized) test API.
   * @param {Object} content
   * @returns
   */
  async createDocument(content, parent_id?: string): Promise<TileDocument<CeramicDocContent>> {
    const permlink = base64url.encode(Crypto.randomBytes(6))
    const now = new Date()
    const doc = await TileDocument.create<CeramicDocContent>(
      this.ceramic,
      {
        parent_id: parent_id,
        content,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { tags: ['spk_network'], controllers: [this.ceramic.did.id] },
      { anchor: true, publish: false },
    )
    let dataRecord = await this.core.idx.get('rootPosts', this.ceramic.did.id)
    if (dataRecord) {
      dataRecord[permlink] = doc.id.toUrl()
    } else {
      dataRecord = {
        [permlink]: doc.id.toUrl(),
      }
    }
    await this.core.idx.set('rootPosts', dataRecord)
    await this.core.graphDocs.insertOne({
      id: doc.id.toString(),
      content,
      created_at: new Date(),
      expire: null,
      first_seen: new Date(),
      last_updated: new Date(),
      last_pinged: new Date(),
      pinned: true,
      parent_id: parent_id,
      creator_id: this.ceramic.did.id,
      type: 'LINKED_DOC',
    })
    await this.core.oplogService.insertEntry({
      type: 'CREATE',
      stream_id: doc.id.toString(),
      date: new Date(),
      meta: {
        state_counter: 0,
        version_id: doc.tip.toString(),
      },
    })
    return doc
  }

  public getMongoSortOption(sort: DocSortOption): any {
    switch (sort) {
      case DocSortOption.createdasc:
        return { created_at: 1 }
      case DocSortOption.createddesc:
        return { created_at: -1 }
      case DocSortOption.updatedasc:
        return { updated_at: 1 }
      case DocSortOption.updateddesc:
        return { updated_at: -1 }
      default:
        throw new Error(`Invalid sort option ${sort}`)
    }
  }

  async *getAllDocs(
    skip = 0,
    limit = 25,
    sort: DocSortOption = DocSortOption.createddesc,
  ): AsyncGenerator<DocumentViewDto> {
    const cursor = this.core.graphDocs.find(
      {},
      {
        skip,
        limit,
        sort: this.getMongoSortOption(sort),
      },
    )
    for await (const doc of cursor) {
      yield DocumentViewDto.fromIndexedDocument(doc)
    }
  }
}
