import { NULL_DID } from "../../../../../config.service";
import { indexerContainer } from "../../../indexer-api.module";

export async function CeramicProfile(args: any) {
  if (!args.userId) {
    return null;
  }
  const basicProfile = await indexerContainer.self.idx.get<any>(
    "basicProfile",
    args.userId
  );
  if (!basicProfile) {
    return {
      did: args.userId,
    };
  }
  return {
    did: args.userId,
    name: basicProfile.name,
    description: basicProfile.description,
    location: basicProfile.location,
    birthDate: basicProfile.birthDate,
    url: basicProfile.url,
    gender: basicProfile.gender,
    homeLocation: basicProfile.homeLocation,
    residenceCountry: basicProfile.residenceCountry,
    nationalities: basicProfile.nationalities,
    affiliations: basicProfile.affiliations,
    images: {
      avatar: basicProfile?.image?.original?.src,
      background: basicProfile?.background?.original?.src,
    },
  };
}
export class SocialPost {
  data: any;
  constructor(data: any) {
    this.data = data;
  }

  get stream_id() {
    return this.data.stream_id || this.data.id;
  }

  get version_id() {
    return this.data.version_id;
  }

  get state_control() {
    return this.data.state_control || {};
  }

  get parent_id() {
    return this.data.parent_id;
  }

  get title() {
    if(this.creator_id === NULL_DID) {
      return 'Unsupported Content'
    }
    return this.data.content.title;
  }

  get body() {
    if(this.creator_id === NULL_DID) {
      return 'Unsupported Content: This content was created using the arbitrary content interface. Please access via the associated indexer.'
    }
    return this.data.content.body;
  }

  get category() {
    if(!this.data.content) {
      return null
    }
    return this.data.content.category;
  }

  get lang() {
    if(!this.data.content) {
      return null
    }
    return this.data.content.lang;
  }

  get type() {
    if(!this.data.content) {
      return null
    }
    return this.data.content.type;
  }

  get app() {
    if(!this.data.content) {
      return null
    }
    return this.data.content.app;
  }

  get json_metadata() {
    if(!this.data.content) {
      return null
    }
    return this.data.content.json_metadata;
  }

  get app_metadata() {
    if(!this.data.content) {
      return null
    }
    return this.data.content.app_metadata;
  }

  get debug_metadata() {
    if(!this.data.content) {
      return null
    }
    return this.data.content.debug_metadata;
  }

  get community_ref() {
    if(!this.data.content) {
      return null
    }
    return this.data.content.community_ref;
  }

  get creator_id() {
    return this.data.creator_id;
  }

  get created_at() {
    return new Date(this.data.created_at).toISOString();
  }

  get updated_at() {
    return new Date(this.data.updated_at).toISOString();
  }

  async children() {
    if(!this.stream_id) {
      return []
    }
    const childIds = indexerContainer.self.docCacheService.getDocChildren(this.stream_id)
    const out = []
    for await (const child of childIds) {
      out.push(new SocialPost(child))
    }
    return out
  }

  async parent_post() {
    if(!this.parent_id) {
      return null
    }
    const doc = await indexerContainer.self.docCacheService.getDocument(this.parent_id)
    
    return new SocialPost(doc)
  }

  author() {
      console.log(this.data)
      return CeramicProfile({
          userId: this.creator_id
      })
  }
}
