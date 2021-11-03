import CeramicClient from '@ceramicnetwork/http-client'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import { DocumentView } from '../../api/resources/document.view'
import { CoreService } from './core.service'

export class DocCacheService {
  constructor(private readonly ceramic: CeramicClient, private readonly core: CoreService) {}

  /**
   * @description Refresh a cached doc that already exists
   * @param streamId stream ID of the doc to refresh in the index
   */
  public async refreshCachedDoc(streamId: string) {
    const tileDoc = await TileDocument.load<DocumentView>(this.ceramic, streamId)

    const res = await this.core.graphDocs.findOneAndUpdate(
      {
        id: streamId,
      },
      {
        $set: {
          version_id: tileDoc.tip.toString(),
          last_updated: new Date(),
          last_pinged: new Date(),
          content: tileDoc.content.content,
        },
      },
    )
  }

  /**
   * @description Cache a doc that has not been cached before
   * @param streamId stream ID of ceramic document to initialize in the cache
   */
  public async initializeCachedDoc(streamId: string): Promise<void> {
    const tileDoc = await TileDocument.load<DocumentView>(this.ceramic, streamId)

    // Assign creator ID as the first controller on the document
    const creatorId = tileDoc.controllers[0]

    // TODO - come up with a way to keep created_at deterministic across all nodes

    await this.core.graphDocs.insertOne({
      id: streamId,
      content: tileDoc.content.content,
      created_at: new Date(),
      expire: null,
      first_seen: new Date(),
      last_updated: new Date(),
      last_pinged: new Date(),
      pinned: true,
      parent_id: tileDoc.content.parent_id,
      version_id: tileDoc.tip.toString(),
      creator_id: creatorId,
    })

    await this.core.initGraphIndexNode(streamId, tileDoc.content.parent_id)
  }
}
