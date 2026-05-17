import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import type * as http from 'node:http'
import { once } from 'node:events'

const SANDBOX_ROOT = path.join(os.tmpdir(), 'oma-dashboard-parity-overview-sandbox')
const STORE_FILE = path.join(SANDBOX_ROOT, 'accounts.json')
const AUTH_FILE = path.join(SANDBOX_ROOT, 'auth.json')
const WEB_DIST_DIR = path.resolve(process.cwd(), 'tests/fixtures/web-dist')
const originalEnv = process.env

let startWebConsole: typeof import('../../src/web.js').startWebConsole
let getCodexAuthPath: typeof import('../../src/codex-auth.js').getCodexAuthPath

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve free port'))
        return
      }
      const port = address.port
      server.close((err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(port)
      })
    })
    server.on('error', reject)
  })
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function seedSandbox(): void {
  fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ OPENAI_API_KEY: null, tokens: {} }, null, 2))

  const accounts: Record<string, unknown> = {
    alpha: {
      alias: 'alpha',
      accessToken: 'token-alpha',
      refreshToken: 'refresh-alpha',
      expiresAt: Date.now() + 60_000,
      email: 'alpha@example.com',
      usageCount: 3,
      enabled: true,
      tags: ['core'],
      notes: 'primary account',
      source: 'opencode',
      rateLimits: {
        fiveHour: { limit: 100, remaining: 80, resetAt: Date.now() + 60_000, updatedAt: Date.now() },
        weekly: { limit: 1000, remaining: 700, resetAt: Date.now() + 120_000, updatedAt: Date.now() }
      },
      limitsConfidence: 'fresh'
    },
    beta: {
      alias: 'beta',
      accessToken: 'token-beta',
      refreshToken: 'refresh-beta',
      expiresAt: Date.now() + 120_000,
      email: 'beta@example.com',
      usageCount: 7,
      enabled: true,
      tags: ['backup'],
      notes: 'secondary account',
      source: 'codex',
      rateLimits: {
        fiveHour: { limit: 100, remaining: 50, resetAt: Date.now() + 60_000, updatedAt: Date.now() },
        weekly: { limit: 1000, remaining: 450, resetAt: Date.now() + 120_000, updatedAt: Date.now() }
      },
      limitsConfidence: 'stale'
    }
  }

  fs.writeFileSync(
    STORE_FILE,
    JSON.stringify(
      {
        version: 2,
        activeAlias: 'alpha',
        rotationIndex: 0,
        lastRotation: 1_700_000_000_000,
        rotationStrategy: 'round-robin',
        settings: {
          rotationStrategy: 'round-robin',
          criticalThreshold: 10,
          lowThreshold: 30,
          accountWeights: {},
          featureFlags: {
            antigravityEnabled: false,
            stickySessionsEnabled: false
          }
        },
        accounts,
      },
      null,
      2
    )
  )
}

beforeAll(async () => {
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
  }
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ OPENAI_API_KEY: null, tokens: {} }, null, 2))

  process.env = {
    ...originalEnv,
    OPENCODE_MULTI_AUTH_STORE_DIR: SANDBOX_ROOT,
    OPENCODE_MULTI_AUTH_STORE_FILE: STORE_FILE,
    OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE: AUTH_FILE,
    OPENCODE_MULTI_AUTH_WEB_DIST_DIR: WEB_DIST_DIR
  }

  ;({ startWebConsole } = await import('../../src/web.js'))
  ;({ getCodexAuthPath } = await import('../../src/codex-auth.js'))
})

afterAll(() => {
  try {
    if (getCodexAuthPath) {
      fs.unwatchFile(getCodexAuthPath())
    }
  } catch {
    // ignore
  }
  process.env = originalEnv
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
  }
})

describe('dashboard parity overview', () => {
  it('serves the SPA instead of the legacy inline dashboard', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')

      const body = await response.text()
      // SPA fixture markers
      expect(body).toContain('fixture-spa-shell')
      expect(body).toContain('<script type="module"')

      // Should NOT contain legacy inline script patterns
      expect(body).not.toContain('function renderMeta')
      expect(body).not.toContain('function renderLogin')
      expect(body).not.toContain('function renderQueue')
      expect(body).not.toContain('<script>')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('returns dashboard state with overview-backing fields', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/state`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')

      const state = (await response.json()) as Record<string, unknown>

      // Meta card backing fields
      expect(state).toHaveProperty('accounts')
      expect(Array.isArray(state.accounts)).toBe(true)
      expect(state).toHaveProperty('deviceAlias')
      expect(state).toHaveProperty('recommendedAlias')
      expect(state).toHaveProperty('authPath')
      expect(state).toHaveProperty('authSummary')
      expect(state).toHaveProperty('storeStatus')
      expect(state).toHaveProperty('lastSyncAt')
      expect(state).toHaveProperty('lastSyncAlias')
      expect(state).toHaveProperty('autoLogin')

      // Login/queue backing fields (null when idle)
      expect(state).toHaveProperty('login')
      expect(state).toHaveProperty('lastLoginError')
      expect(state).toHaveProperty('queue')

      // Operator notice backing fields
      expect(state).toHaveProperty('lastSyncError')
      expect(typeof (state.storeStatus as Record<string, unknown>).locked).toBe('boolean')
      expect(typeof (state.storeStatus as Record<string, unknown>).encrypted).toBe('boolean')
      expect(state.storeStatus).toHaveProperty('error')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('exposes login signal shape in API state contract', async () => {
    // The login field is a live signal managed by the server, not the store file.
    // Verify the field exists and has the expected shape type in the API contract.
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/state`)
      expect(response.status).toBe(200)

      const state = (await response.json()) as Record<string, unknown>
      // Login field must be present (null when idle, object when active)
      expect(state).toHaveProperty('login')
      // lastLoginError must be present
      expect(state).toHaveProperty('lastLoginError')

      // When login is null (idle), verify the field is explicitly null
      const login = state.login
      expect(login).toBeNull()
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('exposes queue signal shape in API state contract', async () => {
    // The queue field is a live signal from the in-memory refresh queue.
    // Verify the field exists and has the expected shape in the API contract.
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/state`)
      expect(response.status).toBe(200)

      const state = (await response.json()) as Record<string, unknown>
      // Queue field must be present (null when idle, object when active)
      expect(state).toHaveProperty('queue')

      // When queue is null (idle), verify the field is explicitly null
      const queue = state.queue
      expect(queue).toBeNull()
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('returns null login and queue when no activity is in progress', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/state`)
      expect(response.status).toBe(200)

      const state = (await response.json()) as Record<string, unknown>
      // When no login/queue activity, these should be null
      expect(state.login).toBeNull()
      expect(state.queue).toBeNull()
      expect(state.lastLoginError).toBeNull()
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('preserves API endpoints for quick actions', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')

      // Verify sync endpoint exists and responds
      const syncResponse = await fetch(`http://127.0.0.1:${port}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      expect(syncResponse.status).toBe(200)
      const syncBody = (await syncResponse.json()) as Record<string, unknown>
      expect(syncBody).toHaveProperty('ok')

      // Verify token refresh endpoint
      const tokenResponse = await fetch(`http://127.0.0.1:${port}/api/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      expect(tokenResponse.status).toBe(200)
      const tokenBody = (await tokenResponse.json()) as Record<string, unknown>
      expect(tokenBody).toHaveProperty('results')

      // Verify limits refresh endpoint
      const limitsResponse = await fetch(`http://127.0.0.1:${port}/api/limits/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      expect([200, 409]).toContain(limitsResponse.status)

      // Verify stop queue endpoint
      const stopResponse = await fetch(`http://127.0.0.1:${port}/api/limits/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      expect(stopResponse.status).toBe(200)
      const stopBody = (await stopResponse.json()) as Record<string, unknown>
      expect(stopBody).toHaveProperty('ok')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })
})
