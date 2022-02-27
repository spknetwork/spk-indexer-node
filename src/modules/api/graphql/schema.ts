export const schema = `
    type SocialContent {
        streamId: String

        title: String
        body: String
        category: String
        
        refs: [String]
        tags: [String]
        image: [String]
        lang: String

        type: String
        app: String

        json_metadata: String
        app_metadata: String
        community_ref: String

        children: [SocialContent]
        author: CeramicProfile
    }
    
    type BasicProfile {
        name: String
        description: String
        avatar: String
        background: String
        url: String

        emoji: String
        gender: String
        residenceCountry: String
        homeLocation: String
        nationalities: [String]
        affiliations: [String]
    }
    type Document {
        streamId: String
        parentId: String

        content: String
    }
    type DocumentChild {
        parentId: String
        streamId: String
        creatorId: String
    }
    type CeramicCryptoAccount {
        id: String
    }
    type ProfileImages {
        avatar: String
        background: String
    }
    type CeramicProfile {
        did: String
        name: String
        description: String
        images: ProfileImages
    }
    type PubsubPeer {
        peerId: String
    }
    type SyncHead {
        streamId: String
        creatorId: String
        namespace: String
    }
    type Query {
        
        ceramicProfile(userId: String): CeramicProfile
        documentChildren(streamId: String): [DocumentChild]

        socialPost(post_id: String): SocialContent

        sync(namespace: String): [SyncHead]
        pubsubPeers: [PubsubPeer]
    }
`
