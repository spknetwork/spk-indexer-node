import { CeramicClient } from '@ceramicnetwork/http-client'
import { MongoClient } from 'mongodb'
import { ConfigService } from '../../../config.service'
import KeyDidResolver from 'key-did-resolver'
import { DID } from 'dids'
import { randomBytes } from 'crypto'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { DocCacheService } from './doc-cache.service'
import { CoreService } from './core.service'
import { MockSpan } from '../../../common/opentelemetry/mock-span.class'

describe('schema validator service should operate', () => {
  let docCacheService: DocCacheService
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

    const coreService = new CoreService(ceramic, mongoClient)
    await coreService.start()
    docCacheService = coreService.docCacheService
  })

  it('should create document and verify created timestamp', async () => {
    const doc = await docCacheService.createDocument({ testkey: 'testValue' })

    const isValid = await docCacheService.docCreateTimestampIsValid(
      doc.id.toString(),
      doc.content.created_at,
    )

    expect(isValid).toBeTruthy()
  })

  it('should create and return document', async () => {
    const testContent = { testkey: 'testvalue' }
    const created = await docCacheService.createDocument(testContent)
    const fetched = await docCacheService.getDocument(created.id.toString(), new MockSpan())
    expect(created.id.toString()).toEqual(fetched.stream_id)
  })
})
