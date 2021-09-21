import CborDag from '@ipld/dag-cbor'

export function encode(msg) {
  if (!msg.type) {
    msg.app = 'spk.network'
  }
  return CborDag.encode(msg)
}

export function decode(msg) {
  const obj = CborDag.decode(msg) as any
  if (typeof obj !== 'object') {
    throw new Error('Invalid message type [0]')
  }
  if (obj.app !== 'spk.network') {
    throw new Error('Invalid message type [1]')
  }
  return obj
}
