import { IPFS_PUBSUB_TOPIC } from '../../peer-to-peer/p2p.model'
import { indexerContainer } from '../indexer-api.module'
import GraphQLJSON from 'graphql-type-json'

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
    console.log(userDocs)
    return []
  },
  publicFeed: async (args: any) => {
    const query = {}
    if (args.tag) {
      query['tags'] = args.tag
    }
    return await indexerContainer.self.graphDocs
      .find(
        {
          content: {},
        },
        {
          sort: {
            created_at: -1,
          },
        },
      )
      .toArray()
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
    console.log(postContent)

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
