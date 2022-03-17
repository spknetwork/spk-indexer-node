import { IPFS_PUBSUB_TOPIC } from '../../../peer-to-peer/p2p.model'
import { indexerContainer } from '../../indexer-api.module'
import GraphQLJSON from 'graphql-type-json'
import { IndexedDocument } from '../../../graph-indexer/graph-indexer.model'

export class Document {
  rawDoc: IndexedDocument
  constructor(rawDoc: any) {
    if (rawDoc.content === null) {
      rawDoc.content = undefined //Slightly easier null check
    }
    this.rawDoc = rawDoc
  }
  async author() {
    return await Resolvers.ceramicProfile({ userId: this.rawDoc.creator_id })
  }
  async children() {
    return await Document.run({
      parent_id: this.rawDoc.id,
    })
  }
  get stream_id() {
    return this.rawDoc.id
  }
  get parent_id() {
    return this.rawDoc.parent_id
  }
  get title() {
    return (this.rawDoc.content as any)?.title
  }
  get body() {
    return (this.rawDoc.content as any)?.body
  }
  get category() {
    return (this.rawDoc.content as any)?.category
  }
  get image() {
    return (this.rawDoc.content as any)?.image
  }
  get lang() {
    return (this.rawDoc.content as any)?.lang
  }
  get tags() {
    return (this.rawDoc.content as any)?.tags
  }
  get type() {
    return (this.rawDoc.content as any)?.type
  }
  get json_metadata() {
    return (this.rawDoc.content as any)?.json_metadata
  }
  get app_metadata() {
    return (this.rawDoc.content as any)?.app_metadata
  }
  get community_ref() {
    return (this.rawDoc.content as any)?.community_ref
  }
  static async run(args: any) {
    const query = {}
    if (args.tag) {
      query['content.tags'] = args.tag
    }
    console.log(args)
    if (args.creator_id) {
      query['creator_id'] = args.creator_id
    }
    if (args.parent_id || args.parent_id === null) {
      query['parent_id'] = args.parent_id
    }
    const docs = await indexerContainer.self.graphDocs
      .find(query, {
        sort: {
          created_at: -1,
        },
      })
      .toArray()

    return docs.map((e) => new Document(e))
  }
}

export const Resolvers = {
  JSON: GraphQLJSON,
  author: () => {},
  sync: async (args: any) => {
    console.log(args)
    const out = (await indexerContainer.self.graphDocs.find({}).toArray()).map((e) => {
      return {
        streamId: e.id,
        creatorId: e.creator_id,
      }
    })
    return out
  },
  posts: async (args: any) => {
    const userDocs = []
    for await (const item of indexerContainer.self.docCacheService.getDocsForUser(args.userId)) {
      userDocs.push(item)
    }
    return []
  },
  publicFeed: async (args: any) => {
    return await Document.run(args)
  },
  documentChildren: async (args: any) => {
    const out = []
    for await (const item of indexerContainer.self.docCacheService.getDocChildren(args.docId)) {
      out.push({
        ...item,
        contentRaw: item,
      })
    }
    return out
  },
  documentGraph: async (args: any) => {},
  socialPost: async (args: any) => {
    const postContent = await indexerContainer.self.docCacheService.getDocument(args.post_id)

    const children = async () => {
      const childIds = indexerContainer.self.docCacheService.getDocChildren(args.post_id)
      const out = []
      for await (const child of childIds) {
        if (child.content) {
          child.content['author'] = () => Resolvers.ceramicProfile({ userId: child.creatorId })
          out.push(child.content)
        }
      }
      return out
    }
    return {
      ...postContent.content,
      children,
    }
  },
  ceramicProfile: async (args: any) => {
    if (!args.userId) {
      return null
    }
    const basicProfile = await indexerContainer.self.idx.get<any>('basicProfile', args.userId)
    if (!basicProfile) {
      return {
        did: args.userId,
      }
    }
    return {
      did: args.userId,
      name: basicProfile.name,
      description: basicProfile.description,
      images: {
        avatar: basicProfile?.image?.original?.src,
        background: basicProfile?.background?.original?.src,
      },
    }
  },
  pubsubPeers: async () => {
    const peers = await indexerContainer.self.custodianSystem.ipfs.pubsub.peers(
      '/spk.network/testnet-dev/custodian-sync',
    )
    return peers.map((e) => {
      return {
        peerId: e,
      }
    })
  },
  oplogFeed: async (args: any) => {
    return await indexerContainer.self.oplogService.getEntries(args.pagination_id)
  },
}

//https://d12-b-ceramic.3boxlabs.com/
