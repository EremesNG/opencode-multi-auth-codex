import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createHash } from 'node:crypto'
import { getNextAccount } from '../../src/rotation.js'
import { loadStore, saveStore } from '../../src/store.js'
import { updateSettings } from '../../src/settings.js'
import { activateForce } from '../../src/force-mode.js'
import { DEFAULT_CONFIG, type AccountCredentials } from '../../src/types.js'

const TEST_DIR = path.join(os.tmpdir(), `oma-rotation-test-${Date.now()}`)
const TEST_STORE_FILE = path.join(TEST_DIR, 'accounts.json')
const TEST_STICKY_FILE = path.join(TEST_DIR, 'sticky-sessions.json')
const originalEnv = process.env
const originalFetch = global.fetch

type StickySelection = {
  source: 'header:session_id'
  canonical: string
  hash: string
}

function createAccount(alias: string, usageCount: number): AccountCredentials {
  return {
    alias,
    accessToken: `token-${alias}`,
    refreshToken: `refresh-${alias}`,
    expiresAt: Date.now() + 60 * 60 * 1000,
    usageCount,
    enabled: true
  }
}

function createPlanAccount(alias: string, usageCount: number, planType: string): AccountCredentials {
  return {
    ...createAccount(alias, usageCount),
    planType
  }
}

function createStickySelection(rawIdentity: string): StickySelection {
  const canonical = rawIdentity.trim().toLowerCase()
  return {
    source: 'header:session_id',
    canonical,
    hash: createHash('sha256').update(canonical).digest('hex')
  }
}

function writeStickyMappings(entries: Record<string, { alias: string; createdAt: number; lastUsedAt: number }>): void {
  fs.writeFileSync(
    TEST_STICKY_FILE,
    JSON.stringify(
      {
        version: 1,
        updatedAt: 1_700_000_000_000,
        entries
      },
      null,
      2
    ),
    'utf8'
  )
}

function readStickyMappings(): {
  version: number
  updatedAt: number
  entries: Record<string, { alias: string; createdAt: number; lastUsedAt: number }>
} {
  return JSON.parse(fs.readFileSync(TEST_STICKY_FILE, 'utf8')) as {
    version: number
    updatedAt: number
    entries: Record<string, { alias: string; createdAt: number; lastUsedAt: number }>
  }
}

function enableStickySessions(rotationStrategy: 'round-robin' | 'least-used' = 'round-robin'): void {
  const update = updateSettings(
    {
      rotationStrategy,
      featureFlags: {
        antigravityEnabled: false,
        stickySessionsEnabled: true
      } as any
    },
    'test'
  )

  expect(update.success).toBe(true)
}

describe('Rotation Strategy Runtime Behavior', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENCODE_MULTI_AUTH_STORE_DIR: TEST_DIR,
      OPENCODE_MULTI_AUTH_STORE_FILE: TEST_STORE_FILE
    }
    delete process.env.OPENCODE_MULTI_AUTH_ROTATION_STRATEGY
    delete process.env.OPENCODE_MULTI_AUTH_CRITICAL_THRESHOLD
    delete process.env.OPENCODE_MULTI_AUTH_LOW_THRESHOLD

    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('uses persisted least-used strategy even if config still says round-robin', async () => {
    const store = loadStore()
    store.accounts.alpha = createAccount('alpha', 10)
    store.accounts.beta = createAccount('beta', 1)
    saveStore(store)

    const update = updateSettings({ rotationStrategy: 'least-used' }, 'test')
    expect(update.success).toBe(true)

    const rotation = await getNextAccount({
      ...DEFAULT_CONFIG,
      rotationStrategy: 'round-robin'
    })

    expect(rotation?.account.alias).toBe('beta')
  })

  it('applies weighted strategy change immediately', async () => {
    const store = loadStore()
    store.accounts.alpha = createAccount('alpha', 0)
    store.accounts.beta = createAccount('beta', 0)
    saveStore(store)

    const update = updateSettings(
      {
        rotationStrategy: 'weighted-round-robin',
        accountWeights: { beta: 1 }
      },
      'test'
    )
    expect(update.success).toBe(true)

    const rotation = await getNextAccount({
      ...DEFAULT_CONFIG,
      rotationStrategy: 'round-robin'
    })

    expect(rotation?.account.alias).toBe('beta')
  })

  it('prefers pro accounts first for non-spark models', async () => {
    const store = loadStore()
    store.accounts.plus = createPlanAccount('plus', 0, 'plus')
    store.accounts.pro = createPlanAccount('pro', 10, 'pro')
    saveStore(store)

    const rotation = await getNextAccount(
      {
        ...DEFAULT_CONFIG,
        rotationStrategy: 'least-used'
      },
      { model: 'gpt-5.4' }
    )

    expect(rotation?.account.alias).toBe('pro')
  })

  it('restricts spark models to pro accounts only', async () => {
    const store = loadStore()
    store.accounts.plus = createPlanAccount('plus', 0, 'plus')
    store.accounts.pro = createPlanAccount('pro', 10, 'pro')
    saveStore(store)

    const rotation = await getNextAccount(
      {
        ...DEFAULT_CONFIG,
        rotationStrategy: 'least-used'
      },
      { model: 'gpt-5.3-codex-spark' }
    )

    expect(rotation?.account.alias).toBe('pro')
  })

  it('returns null for spark models when no pro accounts are available', async () => {
    const store = loadStore()
    store.accounts.plus = createPlanAccount('plus', 0, 'plus')
    saveStore(store)

    const rotation = await getNextAccount(
      {
        ...DEFAULT_CONFIG,
        rotationStrategy: 'least-used'
      },
      { model: 'gpt-5.3-codex-spark-xhigh' }
    )

    expect(rotation).toBeNull()
  })

  describe('sticky session routing (RED)', () => {
    it('uses the active strategy for the initial sticky assignment and persists the selected alias mapping', async () => {
      const sticky = createStickySelection(' Session-001 ')
      const store = loadStore()
      store.accounts.alpha = createAccount('alpha', 10)
      store.accounts.beta = createAccount('beta', 1)
      saveStore(store)
      enableStickySessions('least-used')

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)

      expect(rotation?.account.alias).toBe('beta')
      expect(fs.existsSync(TEST_STICKY_FILE)).toBe(true)
      expect(readStickyMappings().entries[sticky.hash]).toEqual({
        alias: 'beta',
        createdAt: expect.any(Number),
        lastUsedAt: expect.any(Number)
      })
    })

    it('reuses a healthy sticky account without advancing rotationIndex', async () => {
      const sticky = createStickySelection('session-healthy')
      const stickyNow = Date.now()
      const store = loadStore()
      store.accounts.alpha = createAccount('alpha', 0)
      store.accounts.beta = createAccount('beta', 0)
      store.rotationIndex = 0
      saveStore(store)
      writeStickyMappings({
        [sticky.hash]: {
          alias: 'beta',
          createdAt: stickyNow,
          lastUsedAt: stickyNow
        }
      })
      enableStickySessions('round-robin')

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)
      const updatedStore = loadStore()

      expect(rotation?.account.alias).toBe('beta')
      expect(updatedStore.rotationIndex).toBe(0)
    })

    it('falls back to another valid account and rewrites the sticky mapping when the mapped alias is exhausted', async () => {
      const sticky = createStickySelection('session-fallback')
      const now = Date.now()
      const store = loadStore()
      store.accounts.alpha = {
        ...createAccount('alpha', 0),
        rateLimitedUntil: now + 60_000
      }
      store.accounts.beta = createAccount('beta', 0)
      saveStore(store)
      writeStickyMappings({
        [sticky.hash]: {
          alias: 'alpha',
          createdAt: now,
          lastUsedAt: now
        }
      })
      enableStickySessions('round-robin')

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)

      expect(rotation?.account.alias).toBe('beta')
      expect(readStickyMappings().entries[sticky.hash]?.alias).toBe('beta')
    })

    it('ignores an expired sticky mapping at runtime and falls back to normal selection', async () => {
      const sticky = createStickySelection('session-expired-runtime')
      const now = Date.now()
      const store = loadStore()
      store.accounts.alpha = createAccount('alpha', 5)
      store.accounts.beta = createAccount('beta', 0)
      store.rotationIndex = 0
      saveStore(store)
      writeStickyMappings({
        [sticky.hash]: {
          alias: 'beta',
          createdAt: now - (25 * 60 * 60 * 1000),
          lastUsedAt: now - (25 * 60 * 60 * 1000)
        }
      })
      enableStickySessions('round-robin')

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)

      expect(rotation?.account.alias).toBe('alpha')
      expect(readStickyMappings().entries[sticky.hash]?.alias).toBe('alpha')
    })

    it('keeps the sticky mapping when the mapped alias fails temporarily and no replacement is available', async () => {
      const sticky = createStickySelection('session-temp-failure')
      const now = Date.now()
      const store = loadStore()
      store.accounts.alpha = {
        ...createAccount('alpha', 0),
        rateLimitedUntil: now + 60_000
      }
      saveStore(store)
      writeStickyMappings({
        [sticky.hash]: {
          alias: 'alpha',
          createdAt: now,
          lastUsedAt: now
        }
      })
      enableStickySessions('round-robin')

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)

      expect(rotation).toBeNull()
      expect(readStickyMappings().entries[sticky.hash]?.alias).toBe('alpha')
    })

    it('removes the sticky mapping when the mapped alias has failed permanently and no replacement is available', async () => {
      const sticky = createStickySelection('session-permanent-failure')
      const store = loadStore()
      store.accounts.alpha = {
        ...createAccount('alpha', 0),
        enabled: false
      }
      saveStore(store)
      writeStickyMappings({
        [sticky.hash]: {
          alias: 'alpha',
          createdAt: Date.now(),
          lastUsedAt: Date.now()
        }
      })
      enableStickySessions('round-robin')

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)

      expect(rotation).toBeNull()
      expect(readStickyMappings().entries[sticky.hash]).toBeUndefined()
    })

    it('removes the sticky mapping when the mapped alias has failed permanently and fallback candidates are unusable', async () => {
      const sticky = createStickySelection('session-permanent-failure-with-bad-fallback')
      const now = Date.now()
      const store = loadStore()
      store.accounts.alpha = {
        ...createAccount('alpha', 0),
        enabled: false
      }
      store.accounts.beta = {
        ...createAccount('beta', 0),
        expiresAt: now - 1_000
      }
      saveStore(store)
      writeStickyMappings({
        [sticky.hash]: {
          alias: 'alpha',
          createdAt: now,
          lastUsedAt: now
        }
      })
      enableStickySessions('round-robin')
      global.fetch = (async () => new Response('refresh failed', { status: 500 })) as typeof fetch

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)

      expect(rotation).toBeNull()
      expect(readStickyMappings().entries[sticky.hash]).toBeUndefined()
    })

    it('ignores an existing sticky sidecar when the sticky flag is disabled', async () => {
      const sticky = createStickySelection('session-flag-disabled')
      const store = loadStore()
      store.accounts.alpha = createAccount('alpha', 5)
      store.accounts.beta = createAccount('beta', 0)
      store.rotationIndex = 0
      saveStore(store)
      writeStickyMappings({
        [sticky.hash]: {
          alias: 'beta',
          createdAt: Date.now(),
          lastUsedAt: Date.now()
        }
      })

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)

      expect(rotation?.account.alias).toBe('alpha')
      expect(readStickyMappings().entries[sticky.hash]?.alias).toBe('beta')
    })

    it('bypasses sticky routing while force mode is active', async () => {
      const sticky = createStickySelection('session-force')
      const stickyNow = Date.now()
      const store = loadStore()
      store.accounts.alpha = createAccount('alpha', 0)
      store.accounts.beta = createAccount('beta', 0)
      saveStore(store)
      writeStickyMappings({
        [sticky.hash]: {
          alias: 'beta',
          createdAt: stickyNow,
          lastUsedAt: stickyNow
        }
      })
      enableStickySessions('round-robin')

      const force = activateForce('alpha', 'test')
      expect(force.success).toBe(true)

      const rotation = await getNextAccount(DEFAULT_CONFIG, { sticky } as any)

      expect(rotation?.account.alias).toBe('alpha')
      expect(readStickyMappings().entries[sticky.hash]?.alias).toBe('beta')
    })
  })
})
