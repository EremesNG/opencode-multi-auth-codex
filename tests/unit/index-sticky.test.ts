// @ts-ignore - ESM Jest globals are available at runtime in the test environment.
import { jest } from '@jest/globals'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const esmJest = jest as typeof jest & {
  unstable_mockModule: (moduleName: string, factory: () => Record<string, unknown>) => void
}

describe('Sticky identity request plumbing', () => {
  async function loadIndexModule(): Promise<any> {
    return import('../../src/index.js') as Promise<any>
  }

  it('resolves the canonical sticky identity when an allowlisted identity is explicitly allowed', async () => {
    const { resolveStickyIdentity } = await loadIndexModule()

    const sticky = resolveStickyIdentity({
      headers: new Headers({
        session_id: '  Session-123  ',
        conversation_id: 'ignored-conversation'
      }),
      body: {
        metadata: {
          session_id: 'body-session-should-not-win'
        },
        prompt_cache_key: 'cache-123'
      },
      allowPromptCacheKey: false,
      identitySources: [
        'header:session_id',
        'header:conversation_id',
        'body:metadata.session_id',
        'body:metadata.conversation_id'
      ]
    })

    expect(sticky).toEqual({
      source: 'header:session_id',
      canonical: 'session-123',
      hash: expect.any(String)
    })
  })

  it('returns null when no canonical sticky identity can be derived', async () => {
    const { resolveStickyIdentity } = await loadIndexModule()

    const sticky = resolveStickyIdentity({
      headers: new Headers(),
      body: {
        metadata: {},
        prompt_cache_key: undefined
      },
      allowPromptCacheKey: false,
      identitySources: ['header:session_id']
    })

    expect(sticky).toBeNull()
  })

  it('does not derive sticky identity from prompt_cache_key without explicit authorization', async () => {
    const { resolveStickyIdentity } = await loadIndexModule()

    const sticky = resolveStickyIdentity({
      headers: new Headers(),
      body: {
        prompt_cache_key: 'cache-only-123'
      },
      allowPromptCacheKey: false,
      identitySources: ['body:prompt_cache_key']
    })

    expect(sticky).toBeNull()
  })
})

describe('Sticky account-selection context plumbing', () => {
  const originalEnv = process.env
  const testDir = path.join(os.tmpdir(), `oma-index-sticky-${Date.now()}`)
  const testStoreFile = path.join(testDir, 'accounts.json')

  function createAccessToken(accountId: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      'https://api.openai.com/auth': {
        chatgpt_account_id: accountId
      }
    })).toString('base64url')

    return `${header}.${payload}.signature`
  }

  function seedStore(): void {
    fs.mkdirSync(testDir, { recursive: true })
    fs.writeFileSync(
      testStoreFile,
      JSON.stringify({
        version: 2,
        accounts: {
          alpha: {
            alias: 'alpha',
            accessToken: 'access-alpha',
            refreshToken: 'refresh-alpha',
            expiresAt: Date.now() + 60_000,
            usageCount: 0,
            enabled: true
          }
        },
        activeAlias: null,
        rotationIndex: 0,
        lastRotation: 0,
        forcedAlias: null,
        forcedUntil: null,
        previousRotationStrategy: null,
        forcedBy: null,
        rotationStrategy: 'round-robin'
      }, null, 2),
      { mode: 0o600 }
    )
  }

  beforeEach(() => {
    jest.restoreAllMocks()
    process.env = {
      ...originalEnv,
      OPENCODE_MULTI_AUTH_STORE_DIR: testDir,
      OPENCODE_MULTI_AUTH_STORE_FILE: testStoreFile
    }
    seedStore()
  })

  afterEach(() => {
    process.env = originalEnv
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  async function invokePluginFetch(options: {
    stickyEnabled: boolean
    headers?: Record<string, string>
    body?: Record<string, unknown>
    stickyConfig?: {
      identitySources: Array<
        'header:session_id' |
        'header:conversation_id' |
        'body:metadata.session_id' |
        'body:metadata.conversation_id' |
        'body:prompt_cache_key'
      >
      allowPromptCacheKey: boolean
      ttlMs?: number
      maxEntries?: number
      maxFileBytes?: number
    }
  }): Promise<{ getNextAccount: jest.Mock; fetchSpy: jest.SpyInstance }> {
    jest.resetModules()

    const getNextAccount = jest.fn().mockResolvedValue({
      account: {
        alias: 'alpha',
        accessToken: 'access-alpha',
        refreshToken: 'refresh-alpha',
        expiresAt: Date.now() + 60_000,
        usageCount: 1,
        enabled: true
      },
      token: createAccessToken('acct-123')
    } as any)

    esmJest.unstable_mockModule('../../src/rotation.js', () => ({
      getNextAccount,
      clearAuthInvalid: jest.fn(),
      markAuthInvalid: jest.fn(),
      markModelUnsupported: jest.fn(),
      markRateLimited: jest.fn(),
      markWorkspaceDeactivated: jest.fn()
    }))

    esmJest.unstable_mockModule('../../src/settings.js', () => ({
      getRuntimeSettings: () => ({
        settings: {
          rotationStrategy: 'round-robin',
          criticalThreshold: 10,
          lowThreshold: 30,
          accountWeights: {},
          featureFlags: {
            antigravityEnabled: false,
            stickySessionsEnabled: options.stickyEnabled
          }
        },
        source: 'persisted'
      }),
      getStickySessionRuntimeSettings: () => ({
        identitySources: options.stickyConfig?.identitySources || [
          'header:session_id',
          'header:conversation_id',
          'body:metadata.session_id',
          'body:metadata.conversation_id'
        ],
        allowPromptCacheKey: options.stickyConfig?.allowPromptCacheKey ?? false,
        ttlMs: options.stickyConfig?.ttlMs ?? 86_400_000,
        maxEntries: options.stickyConfig?.maxEntries ?? 1000,
        maxFileBytes: options.stickyConfig?.maxFileBytes ?? 1_048_576
      })
    }))

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )

    const { default: MultiAuthPlugin } = await import('../../src/index.js')
    const hooks = await MultiAuthPlugin({
      client: {},
      $: (() => ({ nothrow: () => ({ catch: () => undefined }) })) as any,
      serverUrl: new URL('http://localhost:3000'),
      project: { id: 'test' },
      directory: testDir
    } as any)

    const auth = await (hooks as any).auth.loader(async () => null as any, {} as any)
    await auth.fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: options.headers,
      body: JSON.stringify({
        model: 'gpt-5.4',
        stream: false,
        ...options.body
      })
    })

    return { getNextAccount, fetchSpy }
  }

  it('passes sticky context into getNextAccount only when the sticky flag is enabled and a canonical identity exists', async () => {
    const { getNextAccount, fetchSpy } = await invokePluginFetch({
      stickyEnabled: true,
      headers: {
        session_id: ' Session-123 '
      },
      body: {
        prompt_cache_key: 'cache-123'
      }
    })

    expect(getNextAccount).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        model: 'gpt-5.4',
        sticky: {
          source: 'header:session_id',
          canonical: 'session-123',
          hash: expect.any(String)
        }
      })
    )

    const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('conversation_id')).toBe('cache-123')
    expect(headers.get('session_id')).toBe('cache-123')
  })

  it('keeps non-sticky selection unchanged when the sticky flag is disabled or no canonical identity exists', async () => {
    const disabled = await invokePluginFetch({
      stickyEnabled: false,
      headers: {
        session_id: 'Session-Disabled'
      },
      body: {
        prompt_cache_key: 'cache-disabled'
      }
    })

    expect(disabled.getNextAccount).toHaveBeenCalledWith(
      expect.any(Object),
      { model: 'gpt-5.4' }
    )

    const noIdentity = await invokePluginFetch({
      stickyEnabled: true,
      headers: {},
      body: {}
    })

    expect(noIdentity.getNextAccount).toHaveBeenCalledWith(
      expect.any(Object),
      { model: 'gpt-5.4' }
    )
  })

  it('uses persisted sticky identity source ordering and prompt-cache authorization at runtime', async () => {
    const { getNextAccount } = await invokePluginFetch({
      stickyEnabled: true,
      headers: {
        session_id: 'session-should-be-ignored'
      },
      body: {
        prompt_cache_key: 'cache-123'
      },
      stickyConfig: {
        identitySources: ['body:prompt_cache_key'],
        allowPromptCacheKey: true
      }
    })

    expect(getNextAccount).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        model: 'gpt-5.4',
        sticky: {
          source: 'body:prompt_cache_key',
          canonical: 'cache-123',
          hash: expect.any(String)
        }
      })
    )
  })
})
