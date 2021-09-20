
const IPFSHTTP = require('ipfs-http-client')

const NodeSchedule = require('node-schedule')

const StreamID = require('@ceramicnetwork/streamid').StreamID

const { encode, decode } = require('./frameCodec')

const IPFS_PUBSUB_TOPIC = "/spk.network/testnet-dev"

const CUS_ANNOUNCE = "cust_announce"

class CustodianSystem {
    constructor(self) {
        this.self = self;

        this.handleSub = this.handleSub.bind(this)
        this.announceCustodian = this.announceCustodian.bind(this)


    }
    async receiveAnnounce(payload, fromId) {
        console.log(payload, fromId)
    }
    async announceCustodian() {
        console.log('running custodian announce')
        const out = (await this.self.graphDocs.find({
            parent_id: null,
            streamId: {$exists: true}
        }).toArray()).map((e) => ({ streamId: StreamID.fromString(e.streamId).bytes, id: e._id }))
        const msg = {
            type: CUS_ANNOUNCE,
            content: out
        }
        console.log(msg)
        const codedMessage = encode(msg);
        console.log(codedMessage)
        await this.ipfs.pubsub.publish(IPFS_PUBSUB_TOPIC, codedMessage)
    }
    async handleSub(message) {

        let msgObj;
        try {
            msgObj = decode(message.data)
        } catch {
            return;
        }
        console.log(message)
        if (msgObj.type === CUS_ANNOUNCE) {
            this.receiveAnnounce(msgObj, message.from)
        }
    }
    async start() {
        this.ipfs = IPFSHTTP.create();

        this.ipfs.pubsub.subscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
        NodeSchedule.scheduleJob('* * * * *', this.announceCustodian)
    }
    async stop() {
        this.ipfs.unsubscribe(IPFS_PUBSUB_TOPIC, this.handleSub)
    }
}

module.exports = CustodianSystem