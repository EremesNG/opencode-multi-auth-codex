import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import type * as http from 'node:http'
import { once } from 'node:events'

const SANDBOX_ROOT = path.join(os.tmpdir(), 'oma-dashboard-parity-operations-sandbox')
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
        accounts: {
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

describe('dashboard parity operations', () => {
  it('serves the SPA with operations surface markers', async () => {
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
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('returns logs with expected shape', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/logs?limit=5`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')

      const logs = (await response.json()) as Record<string, unknown>
      expect(typeof logs.path).toBe('string')
      expect(Array.isArray(logs.lines)).toBe(true)
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('preserves force mode state and activation/clear contracts', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')

      // Get initial force state
      const forceState = await fetch(`http://127.0.0.1:${port}/api/force`)
      expect(forceState.status).toBe(200)
      const forceBody = (await forceState.json()) as Record<string, unknown>
      expect(forceBody).toEqual(
        expect.objectContaining({
          active: false,
          alias: null,
          forcedAt: null,
          forcedUntil: null,
          forcedBy: null,
          remainingMs: 0,
          remainingTime: '0m',
          previousRotationStrategy: null
        })
      )

      // Activate force mode
      const activateForce = await fetch(`http://127.0.0.1:${port}/api/force`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: 'alpha', actor: 'test-suite' })
      })
      expect(activateForce.status).toBe(200)
      const activateBody = (await activateForce.json()) as Record<string, unknown>
      expect(activateBody).toEqual(
        expect.objectContaining({
          ok: true,
          alias: 'alpha',
          remainingMs: expect.any(Number),
          remainingTime: expect.any(String)
        })
      )

      // Verify force state after activation
      const forceAfterActivation = await fetch(`http://127.0.0.1:${port}/api/force`)
      expect(forceAfterActivation.status).toBe(200)
      const forceAfterBody = (await forceAfterActivation.json()) as Record<string, unknown>
      expect(forceAfterBody).toEqual(
        expect.objectContaining({
          active: true,
          alias: 'alpha',
          forcedBy: 'test-suite'
        })
      )

      // Clear force mode
      const clearForce = await fetch(`http://127.0.0.1:${port}/api/force/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      expect(clearForce.status).toBe(200)
      const clearBody = (await clearForce.json()) as Record<string, unknown>
      expect(clearBody).toEqual(
        expect.objectContaining({
          ok: true,
          restoredStrategy: 'round-robin'
        })
      )
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('preserves refresh queue and global operation endpoints', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')

      // Verify state returns queue field (null when idle)
      const stateResponse = await fetch(`http://127.0.0.1:${port}/api/state`)
      expect(stateResponse.status).toBe(200)
      const state = (await stateResponse.json()) as Record<string, unknown>
      expect(state).toHaveProperty('queue')

      // Verify sync endpoint
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

  it('preserves antigravity endpoint contracts with feature gating', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')

      // Antigravity refresh should be disabled by default
      const antigravityRefresh = await fetch(`http://127.0.0.1:${port}/api/antigravity/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      expect(antigravityRefresh.status).toBe(403)
      const refreshBody = (await antigravityRefresh.json()) as Record<string, unknown>
      expect(refreshBody).toEqual({
        error: 'Antigravity feature is disabled',
        code: 'FEATURE_DISABLED',
        feature: 'antigravity'
      })

      // Antigravity refresh-all should be disabled by default
      const antigravityRefreshAll = await fetch(`http://127.0.0.1:${port}/api/antigravity/refresh-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      expect(antigravityRefreshAll.status).toBe(403)
      const refreshAllBody = (await antigravityRefreshAll.json()) as Record<string, unknown>
      expect(refreshAllBody).toEqual({
        error: 'Antigravity feature is disabled',
        code: 'FEATURE_DISABLED',
        feature: 'antigravity'
      })
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('returns force mode state in dashboard state when active', async () => {
    seedSandbox()
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')

      // Activate force mode first
      const activateForce = await fetch(`http://127.0.0.1:${port}/api/force`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: 'alpha', actor: 'test-suite' })
      })
      expect(activateForce.status).toBe(200)

      // Now check dashboard state includes force
      const response = await fetch(`http://127.0.0.1:${port}/api/state`)
      expect(response.status).toBe(200)

      const state = (await response.json()) as Record<string, unknown>
      expect(state.force).toEqual(
        expect.objectContaining({
          active: true,
          alias: 'alpha',
          forcedBy: 'test-suite'
        })
      )
      expect(typeof (state.force as Record<string, unknown>).remainingMs).toBe('number')
      expect(typeof (state.force as Record<string, unknown>).remainingTime).toBe('string')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })
})
