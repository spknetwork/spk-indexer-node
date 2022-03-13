import { Collection } from 'mongodb'
import { CoreService } from './core.service'

const BASIC_PROFILE = 'kjzl6cwe1jw145cjbeko9kil8g9bxszjhyde21ob8epxuxkaon1izyqsu8wgcic'
export class ProfilesService {
  self: CoreService
  profiles: Collection
  constructor(self: CoreService) {
    this.self = self
  }
  async pull(did) {
    const streamId = await this.self.idx.getRecordID(BASIC_PROFILE, did)
  }
  async pullThrough() {}
  async getProfile(did) {
    const profileData = await this.profiles.findOne({
      did,
    })
    console.log(profileData)
  }
  async add(userDid: any) {}
  async profTest(did: string) {
    this.profiles = this.self.db.collection('profiles')
    const strId = await this.self.idx.getIndex(did)
    const streamId = await this.self.idx.getRecordID(BASIC_PROFILE, did)

    await this.profiles.insertOne({
      stream_id: streamId,
      did,
    })
    console.log('str is', strId, streamId)
  }
}
