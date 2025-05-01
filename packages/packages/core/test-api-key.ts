import { ApiKeyManager, InMemoryApiKeyStore } from './dist/gateway/auth/index.js'

async function test() {
  const manager = new ApiKeyManager(new InMemoryApiKeyStore())

  const info = {
    userId: 'user-123',
    roles: ['user'],
    permissions: ['read', 'write'],
    enabled: true,
    expiresAt: new Date(Date.now() + 86400000),
  }

  const apiKey = await manager.generateApiKey(info)
  console.log('Generated API Key:', apiKey.substring(0, 20) + '...')

  const verified = await manager.verifyApiKey(apiKey)
  console.log('Verified:', JSON.stringify(verified, null, 2))
}

test().catch(console.error)
