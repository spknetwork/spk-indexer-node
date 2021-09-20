const CborDag = require('@ipld/dag-cbor')


function encode(msg) {
    if(!msg.type) {
        msg.app = "spk.network"
    }
    return CborDag.encode(msg)
}

function decode(msg)  {
    const obj = CborDag.decode(msg)
    if(typeof obj !== 'object') {
        throw new Error('Invalid message type [0]')
    }
    if(obj.app !== "spk.network") {
        throw new Error('Invalid message type [1]')
    }
    return obj;
}


module.exports = {
    encode,
    decode
}