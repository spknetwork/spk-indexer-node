export const schema = `
    scalar JSON

    type DocumentStateControl {
        height: Int
    }

    type SocialContent {
        stream_id: String
        version_id: String
        parent_id: String
        creator_id: String

        title: String
        body: String
        category: String
        
        refs: [String]
        tags: [String]
        image: [String]
        lang: String

        type: String
        app: String

        json_metadata: JSON
        app_metadata: JSON
        debug_metadata: JSON

        community_ref: String

        children: [SocialContent]
        author: CeramicProfile

        created_at: String
        updated_at: String

        parent_post: SocialContent

        state_control: DocumentStateControl
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
        contentRaw: JSON
    }
    type DocumentChild {
        parentId: String
        streamId: String
        creatorId: String
        contentRaw: JSON
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
        website: String
        location: String
        emoji: String
        birthDate: String
        url: String
        gender: String
        homeLocation: String
        residenceCountry: String
        nationalities: [String]
        affiliations: [String]
        images: ProfileImages
    }
    type PubsubPeer {
        peerId: String
        latency: String
    }
    type SyncHead {
        streamId: String
        creatorId: String
        namespace: String
    }
    type OplogEntryMeta { 
        version_id: String
    }
    type OplogEntry {
        type: String
        date: String
        stream_id: String
        meta: OplogEntryMeta
    }
    type OplogOut {
        count: Int
        pagination_id: String
        items: [OplogEntry]
    }
    type CAIP10 {
        address: String
        did: String
    }
    type Following {
        did: String
        profile: CeramicProfile
    }
    type Query {
        
        resolveCaipLink(address: String): CAIP10
        ceramicProfile(userId: String): CeramicProfile
        documentChildren(streamId: String): [DocumentChild]

        socialPost(post_id: String): SocialContent

        sync(namespace: String): [SyncHead]
        pubsubPeers: [PubsubPeer]
        oplogFeed(pagination_id: String): OplogOut
        publicFeed(tag: String, text: String, creator_id: String, parent_id: String): [SocialContent]
        followingFeed(did: String): [SocialContent]
        following(did: String): [Following]
    }
`
