import { CeramicClient } from '@ceramicnetwork/http-client'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import { MongoClient } from 'mongodb'
import { basicPostSchema } from '../../../schemas/basicPost.schema'
import { ConfigService } from '../../../config.service'
import { RepoManager } from '../../mongo-access/services/repo-manager.service'
import KeyDidResolver from 'key-did-resolver'
import { DID } from 'dids'
import { SchemaValidatorService } from './schema-validator.service'
import { randomBytes } from 'crypto'
import { Ed25519Provider } from 'key-did-provider-ed25519'

describe('schema validator service should operate', () => {
  let service: SchemaValidatorService
  let ceramic: CeramicClient
  beforeAll(async () => {
    const ceramicHost = ConfigService.getConfig().ceramicHost
    ceramic = new CeramicClient(ceramicHost)
    const resolver = { ...KeyDidResolver.getResolver() }
    const did = new DID({ resolver })
    ceramic.did = did
    const seed = randomBytes(32)
    const provider = new Ed25519Provider(seed)
    ceramic.did.setProvider(provider)
    await ceramic.did.authenticate()
    console.log(`authenticated with ceramic host at ${ceramicHost}!`)

    const mongoUrl = `mongodb://${ConfigService.getConfig().mongoHost}`
    const mongoClient = new MongoClient(mongoUrl)
    await mongoClient.connect()
    console.log('Connected successfully to mongo')

    service = new SchemaValidatorService(ceramic, new RepoManager(mongoClient))
  })

  it('should register schema', async () => {
    const schemaDoc = await TileDocument.create(ceramic, basicPostSchema, {
      controllers: [ceramic?.did?.id || ''],
      family: 'schema',
    })

    // test succeeds if this does not throw
    await service.registerSchema(schemaDoc.id.toString())
  })
})
