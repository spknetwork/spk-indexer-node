export interface IndexedDocument {
  author: string // DID
  id: string // StreamID
  parent_author: string // DID
  parent_id: string // StreamID
  content: Record<string, unknown>
}
