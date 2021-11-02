enum Flags {
  BOGON,
}

interface SPKContainer {
  data: any
  type: string // Type of contained data
  created_at: Date
  update_at?: Date
  parent_id?: string
  flags: string[] //Announce BOGON (deletion), etc.
}

interface CommunityRef {
  name: string
  id: string
}

interface SocialContent {
  title: string
  body: string

  refs: string[] //References to content on other chains and/or platforms
  tags: string[] //List of social tags
  image: string[]
  lang: string
  community_ref?: CommunityRef

  type: string // Type of social content
  app: string
  app_metadata: Record<string, unknown>
  json_metadata: Record<string, unknown>
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
