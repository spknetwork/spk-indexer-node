import { StreamID } from '@ceramicnetwork/streamid'
import IPFSHTTP from 'ipfs-http-client'
import NodeSchedule from 'node-schedule'

import { decode, encode } from '../utils/frame-codec.utils'

const IPFS_PUBSUB_TOPIC = '/spk.network/testnet-dev'

const CUS_ANNOUNCE = 'cust_announce'

export class CustodianService {
  ipfs
  constructor(private readonly self) {
    this.self = self

    this.handleSub = this.handleSub.bind(this)
  }
  async receiveAnnounce(payload, fromId) {
    console.log(payload, fromId)
  }
  announceCustodian = async () => {
    console.log('running custodian announce')
    const out = (
      await this.self.graphDocs
        .find({
          parent_id: null,
          streamId: { $exists: true },
        })
        .toArray()
    ).map((e) => ({ streamId: StreamID.fromString(e.streamId).bytes, id: e._id }))
    const msg = {
      type: CUS_ANNOUNCE,
      content: out,
    }
    console.log(msg)
    const codedMessage = encode(msg)
    console.log(codedMessage)
    await this.ipfs.pubsub.publish(IPFS_PUBSUB_TOPIC, codedMessage)
  }
  handleSub = (message) => {
    let msgObj
    try {
      msgObj = decode(message.data)
    } catch {
      return
    }
    console.log(message)
    if (msgObj.type === CUS_ANNOUNCE) {
      void this.receiveAnnounce(msgObj, message.from)
    }
  }
  async start() {
    this.ipfs = IPFSHTTP.create()

    this.ipfs.pubsub.subscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
    NodeSchedule.scheduleJob('* * * * *', this.announceCustodian)
  }
  async stop() {
    this.ipfs.unsubscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
  }
}
