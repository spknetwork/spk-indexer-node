import { ModelManager } from '@glazed/devtools'
import CeramicHTTP from '@ceramicnetwork/http-client'
import { DID } from 'dids'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import KeyResolver from 'key-did-resolver'

const SECRET_KEY = ''
const ceramic = new CeramicHTTP('https://ceramic-clay.3boxlabs.com')
const manager = new ModelManager(ceramic)
void (async () => {
  const keyProvider = new Ed25519Provider(Buffer.from(SECRET_KEY, 'hex'))

  const did = new DID({
    provider: keyProvider,
    resolver: KeyResolver.getResolver(),
  })
  await did.authenticate()
  await ceramic.setDID(did)
  const schema = await manager.createSchema('rootPosts', {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'rootPosts',
    type: 'object',
    description: 'root Posts',
    properties: {
      '^([a-zA-Z]+(-[a-zA-Z]+)+)': {
        type: 'string',
        pattern: '^ceramic://.+',
        maxLength: 128,
      },
    },
  })
  await manager.createDefinition('rootPosts', {
    name: 'My note',
    description: 'A simple text note',
    schema: manager.getSchemaURL(schema),
  })
  console.log(schema)
  console.log(manager.getSchemaURL(schema))
  const model = await manager.toPublished()
  console.log(model)
})()
