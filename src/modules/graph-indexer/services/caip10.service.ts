import { Caip10Link } from '@ceramicnetwork/stream-caip10-link'
import { Collection } from 'mongodb'
import { CoreService } from './core.service'

export class CAIP10Service {
  self: CoreService
  links: Collection
  constructor(self: CoreService) {
    this.self = self
    this.links = this.self.db.collection('caip10_links')
    
  }
  async resolveLink(address: string) {
    const existingLink = await this.links.findOne({
      address: address,
    })
    if (existingLink) {
      return existingLink
    }
    const link = await Caip10Link.fromAccount(this.self.ceramic, address)
    await this.links.insertOne({
      did: link.did,
      address
    })
    return {
      did: link.did,
      address
    }
  }
  async start() {
    try {
      await this.links.createIndex({
        address: -1
      }, {
        unique: true,
        
      })
    } catch {
      
    }
  }
}
