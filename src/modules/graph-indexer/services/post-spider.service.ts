import NodeSchedule from 'node-schedule'
import StreamID from '@ceramicnetwork/streamid'

export class PostSpiderService {
  col
  constructor(private readonly self) {
    this.self = self

    this.pull = this.pull.bind(this)
  }
  async pull() {
    const following = (await (await this.col.find({})).toArray()).map((e) => e.did)
    console.log(following)
    //This will be used for pulling content into indexing layer... TBD
    //Need schema to be developed for very basic social media posts on the network.
  }
  async pullSingle(did: string) {
    const indexData = await this.self.idx.getIndex(did)
    const manifestStreamId = did.split(':')[2]
    await this.self.ceramic.pin.add(manifestStreamId)
    for (const streamId of Object.values(indexData)) {
      await this.self.ceramic.pin.add(StreamID.fromString(streamId as string))
    }
  }
  async add(did) {
    const existingDoc = await this.col.findOne({
      did,
    })
    if (existingDoc) {
      throw new Error('DID already pinned')
    } else {
      await this.col.insertOne({
        did,
      })
      await this.pullSingle(did)
    }
  }
  async ls() {
    const following = (await (await this.col.find({})).toArray()).map((e) => e.did)
    return following
  }
  async rm(did: string) {
    await this.col.findOneAndDelete({
      did,
    })
  }
  async start() {
    this.col = this.self.db.collection('spider.following')
    NodeSchedule.scheduleJob('* * * * *', this.pull)
  }
}
