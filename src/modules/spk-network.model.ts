enum Flags {
  BOGON,
}

/**
 * @todo finishoff/complete
 */
interface SPKContainer {
  data: any
  type: string // Type of contained data
  created_at: Date
  update_at?: Date
  parent_id?: string
  flags: string[] //Announce BOGON (deletion), etc.
}

/**
 * Reference to the community that the content is created under
 * NOTE: This is not and will not be in use until later.
 */
interface CommunityRef {
  name: string
  id: string
}

interface SocialContent {
  title: string
  body: string
  category: string

  //References to content on other chains and/or platforms
  //In the format of platform:username:permlink (subject to change)
  refs?: string[]
  tags: string[] //List of social tags
  image: string[]
  lang: string

  type: string // Type of social content
  app: string

  //TBD
  app_metadata?: Record<string, unknown>
  json_metadata?: Record<string, unknown>
  community_ref?: CommunityRef
}

enum SourceMapType {
  thumbnail,
  video,
  subtitle,
}
interface SourceMap {
  type: SourceMapType
  uri: string
  identifiers?: {
    ssdeep?: string //Ssdeep identifiers
  }
  tags?: string[] //List of typing tags. For example this resource might cover X,Y and Z
}

interface SPKVideo {
  duration: number
  total_size?: number
  source_map: SourceMap[]
}
