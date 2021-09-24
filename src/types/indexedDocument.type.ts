/**
 * NOTE about pulling doc authors
 * 
 * {
    controllers: ["did:3:2341"],  /*<-- We should be able to pull the parent_author from here. 
    Maybe make two types? 
    One for raw data coming from Ceramic and another for what gets put in the database (and often used elsewhere)?
 */
export interface IndexedDocument {
  id: string // StreamID
  parent_id: string // StreamID
  content: Record<string, unknown>
  schemaId?: string
}
