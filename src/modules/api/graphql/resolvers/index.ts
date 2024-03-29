import { IPFS_PUBSUB_TOPIC } from '../../../peer-to-peer/p2p.model'
import { indexerContainer } from '../../indexer-api.module'
import GraphQLJSON from 'graphql-type-json'
import { IndexedDocument } from '../../../graph-indexer/graph-indexer.model'
import { CeramicProfile, SocialPost } from './social'

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

  get created_at() {
    if(typeof this.rawDoc.created_at === 'string') {
      return this.rawDoc.created_at
    }
    return (this.rawDoc.created_at)?.toISOString()
  }

  get updated_at() {
    if(typeof this.rawDoc.updated_at === 'string') {
      return this.rawDoc.updated_at
    }
    return (this.rawDoc.updated_at)?.toISOString()
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
    const query = {
      "content": {$exists: true, $nin: [null]}
    }
    if (args.tag) {
      query['content.tags'] = args.tag
    }
    if (args.creator_id) {
      query['creator_id'] = args.creator_id
      void (async () => {
        try {
          for await(let _ of indexerContainer.self.docCacheService.getDocsForUserFromIdx(args.creator_id)) {}
        } catch(ex) {
          console.log(ex)
        }
      })()
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

    return docs.map((e) => new SocialPost(e))
  },
  documentChildren: async (args: any) => {
    const out = []
    for await (const item of indexerContainer.self.docCacheService.getDocChildren(args.streamId)) {
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

    return new SocialPost(postContent)
  },
  followingFeed: async (args: any) => {
    const connections = await indexerContainer.self.idx.get('socialConnectionIndex', args.did)
    const dids = Object.values(connections).map(e => e.target)
    
    dids.map(async(e) => {
      try {
        for await(let _ of indexerContainer.self.docCacheService.getDocsForUserFromIdx(e)) {}
      } catch {

      }
    })
    const docs = await ( indexerContainer.self.graphDocs.find({
      creator_id: {
        $in: dids
      }
    }, {
      sort: {
        created_at: -1
      }
    }).toArray())
    return docs.map((e: any) => {
      return new SocialPost(e)
    })
  },
  following: async (args: any) => {
    const connections = await indexerContainer.self.idx.get('socialConnectionIndex', args.did)
    const output = Object.values(connections)

    let out = []
    for(let e of output) {
      out.push({
        did: e.target,
        profile: await Resolvers.ceramicProfile({ userId: e.target })
      })
    }
    

    return out;
  },
  followers: async (args: any) => {
    const connections = await indexerContainer.self.socialConnections.connections.find({
      following: args.did
    }).toArray()

    let out = []
    for(let e of connections) {
      out.push({
        did: e.follower,
        profile: async () => await Resolvers.ceramicProfile({ userId: e.follower })
      })
    }
    

    return out;
  },
  ceramicProfile: CeramicProfile,
  pubsubPeers: async () => {
    const peers = await indexerContainer.self.custodianSystem.ipfs.pubsub.peers(
      '/spk.network/testnet-dev/custodian-sync',
    )
    const swarmPeers = await indexerContainer.self.custodianSystem.ipfs.swarm.peers({
      verbose: true
    })
    let out = []
    for(let peer of swarmPeers) {
      if(peers.includes(peer.peer)) {
        console.log(peer)
        out.push({
          peerId: peer.peer,
          latency: peer.latency
        })
      }
    }
    return out
  },
  oplogFeed: async (args: any) => {
    return await indexerContainer.self.oplogService.getEntries(args.pagination_id)
  },
  resolveCaipLink: async (args: any) => {
    return await indexerContainer.self.caipService.resolveLink(args.address)
  },
  pins: async (args: any) => {
    return await indexerContainer.self.pins.ls({
      type: args.type
    })
  }
}

//https://d12-b-ceramic.3boxlabs.com/
